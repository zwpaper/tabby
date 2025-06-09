import {
  isAssistantMessageWithCompletedToolCalls,
  updateToolCallResult,
} from "@ai-sdk/ui-utils";
import {
  findTodos,
  fromUIMessage,
  getLogger,
  mergeTodos,
  toUIMessages,
} from "@ragdoll/common";
import type { DB, Environment, TaskEvent, Todo } from "@ragdoll/db";
import type { AppType, PochiEventSource } from "@ragdoll/server";
import type { ToolFunctionType } from "@ragdoll/tools";
import type { ToolInvocation, UIMessage } from "ai";
import type { hc } from "hono/client";
import { readEnvironment } from "./lib/read-environment";
import { applyDiff } from "./tools/apply-diff";
import { executeCommand } from "./tools/execute-command";
import { globFiles } from "./tools/glob-files";
import { listFiles } from "./tools/list-files";
import { multiApplyDiff } from "./tools/multi-apply-diff";
import { readFile } from "./tools/read-file";
import { searchFiles } from "./tools/search-files";
import { todoWrite } from "./tools/todo-write";
import { writeToFile } from "./tools/write-to-file";

type TaskStatus = DB["task"]["status"]["__select__"];

export interface RunnerContext {
  cwd: string;
  // Add more context properties here as needed in the future
  // e.g., environment variables, workspace settings, etc.
}

const ToolMap: Record<
  string,
  // biome-ignore lint/suspicious/noExplicitAny: ToolFunctionType requires any for generic tool parameters
  (context: RunnerContext) => ToolFunctionType<any>
> = {
  readFile,
  applyDiff,
  globFiles,
  listFiles,
  multiApplyDiff,
  todoWrite,
  writeToFile,
  searchFiles,
  executeCommand,
};

const logger = getLogger("TaskRunner");

function safeCall<T>(x: Promise<T>) {
  return x.catch((e) => {
    return {
      error: e.message as string,
    };
  });
}

type ApiClient = ReturnType<typeof hc<AppType>>;

type TaskStepProgress =
  | {
      type: "loading-task";
      phase: "begin";
    }
  | {
      type: "loading-task";
      phase: "end";
      task: Awaited<ReturnType<TaskRunner["loadTask"]>>;
    }
  | {
      type: "executing-tool-call";
      phase: "begin";
      toolName: string;
      toolCallId: string;
      toolArgs: unknown;
    }
  | {
      type: "executing-tool-call";
      phase: "end";
      toolName: string;
      toolCallId: string;
      toolResult: unknown;
    }
  | {
      type: "sending-result";
      phase: "begin";
      message: UIMessage;
    }
  | {
      type: "sending-result";
      phase: "end";
    }
  | {
      type: "step-completed";
      status: TaskStatus;
    };

export type TaskRunnerProgress =
  | (TaskStepProgress & { step: number })
  | {
      type: "runner-stopped";
      status: TaskStatus | undefined;
    };

export class TaskRunner {
  private readonly context: RunnerContext;
  private todos: Todo[] = [];

  constructor(
    private readonly apiClient: ApiClient,
    private readonly pochiEvents: PochiEventSource,
    private readonly taskId: number,
    context?: RunnerContext,
  ) {
    this.context = context || { cwd: process.cwd() };
  }

  private async buildEnvironment(): Promise<Environment> {
    const environment = await readEnvironment(this.context);
    return {
      ...environment,
      todos: this.todos,
    };
  }

  private updateTodos(todos: Todo[] = []) {
    // Update the context todos with the new todos
    this.todos = todos.length ? todos : mergeTodos(this.todos, todos);
  }

  /**
   * @yields {@link TaskStepProgress} - Progress updates
   * @throws {@link Error} if the task is in an invalid state, or any error occurs during execution
   */
  private async *step(): AsyncGenerator<TaskStepProgress> {
    yield { type: "loading-task", phase: "begin" };
    const task = await this.loadTask();
    yield { type: "loading-task", phase: "end", task };

    logger.info("step start", task.status);
    if (task.status === "streaming") {
      throw new Error("Task is already running");
    }

    if (task.status === "completed") {
      throw new Error("Task is already completed");
    }

    if (task.status === "pending-input") {
      throw new Error("Task is pending input");
    }

    // We're only abled to handle "error" / tool-call
    const messages = toUIMessages(task.conversation?.messages || []);

    const lastMessage = messages.at(-1);
    if (!lastMessage) {
      throw new Error("No messages found");
    }

    if (lastMessage.parts !== undefined) {
      const todos = findTodos(lastMessage);
      this.updateTodos(todos);
    }

    while (
      lastMessage.role === "assistant" &&
      !isAssistantMessageWithCompletedToolCalls(lastMessage)
    ) {
      const nextToolCall = findNextToolCall(lastMessage);
      if (!nextToolCall) {
        throw new Error("No tool call found");
      }

      yield {
        type: "executing-tool-call",
        phase: "begin",
        toolName: nextToolCall.toolName,
        toolCallId: nextToolCall.toolCallId,
        toolArgs: nextToolCall.args,
      };
      const toolResult = await this.executeToolCall(nextToolCall);

      yield {
        type: "executing-tool-call",
        phase: "end",
        toolName: nextToolCall.toolName,
        toolCallId: nextToolCall.toolCallId,
        toolResult,
      };
      updateToolCallResult({
        messages,
        toolCallId: nextToolCall.toolCallId,
        toolResult,
      });
    }

    // last message is ready to be sent to llm.
    const abortController = new AbortController();
    const streamDone = new Promise<TaskStatus>((resolve) => {
      let streamingStarted = false;
      const unsubscribe = this.pochiEvents.subscribe<TaskEvent>(
        "task:status-changed",
        ({ data }) => {
          if (data.taskId !== this.taskId) {
            return;
          }

          if (data.status === "streaming" && !streamingStarted) {
            streamingStarted = true;
            return;
          }

          if (data.status !== "streaming" && streamingStarted) {
            unsubscribe();
            resolve(data.status);
            return;
          }

          throw new Error(
            `Unexpected task status change: ${data.status} for task ${data.taskId}`,
          );
        },
      );
    });

    const environment = await this.buildEnvironment();
    logger.info(
      "Starting streaming for task",
      this.taskId,
      "with environment",
      environment,
    );

    yield { type: "sending-result", phase: "begin", message: lastMessage };
    const resp = await this.apiClient.api.chat.stream.$post(
      {
        json: {
          id: this.taskId.toString(),
          message: fromUIMessage(lastMessage),
          environment,
        },
      },
      {
        init: {
          signal: abortController.signal,
        },
      },
    );

    if (!resp.ok) {
      const error = await resp.text();
      throw new Error(`Failed to start streaming ${resp.statusText}: ${error}`);
    }
    yield { type: "sending-result", phase: "end" };

    const status = await streamDone;
    yield {
      type: "step-completed",
      status,
    };
  }

  private async executeToolCall(tool: ToolInvocation) {
    if (tool.state !== "call") {
      throw new Error(`Tool invocation is not in call state: ${tool.state}`);
    }
    const toolFunction = ToolMap[tool.toolName];
    if (!toolFunction) {
      return {
        error: `Tool ${tool.toolName} not found.`,
      };
    }

    logger.info(
      "Executing tool",
      tool.toolName,
      "with args",
      tool.args,
      "in cwd",
      this.context.cwd,
    );

    return await safeCall(
      toolFunction(this.context)(tool.args, {
        messages: [],
        toolCallId: tool.toolCallId,
      }),
    );
  }

  /**
   * Start the task runner and yield progress updates
   * @yields {@link TaskRunnerProgress} - Progress updates throughout task execution
   */
  async *start(): AsyncGenerator<TaskRunnerProgress> {
    let step = 0;
    while (true) {
      let status: TaskStatus | undefined = undefined;
      for await (const progress of this.step()) {
        yield { ...progress, step };
        if (progress.type === "step-completed") {
          status = progress.status;
        }
      }
      if (status !== "pending-tool") {
        yield {
          type: "runner-stopped",
          status,
        };
        return;
      }
      step++;
    }
  }

  async loadTask() {
    const resp = await this.apiClient.api.tasks[":id"].$get({
      param: {
        id: this.taskId.toString(),
      },
    });

    if (!resp.ok) {
      throw new Error(`Failed to fetch task: ${resp.statusText}`);
    }

    return await resp.json();
  }
}

function findNextToolCall(message: UIMessage): ToolInvocation | undefined {
  for (const part of message.parts) {
    if (
      part.type === "tool-invocation" &&
      part.toolInvocation.state === "call"
    ) {
      return part.toolInvocation;
    }
  }
}
