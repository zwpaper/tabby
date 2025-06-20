import {
  type ToolInvocationUIPart,
  generateId,
  getMessageParts,
  isAssistantMessageWithCompletedToolCalls,
  prepareAttachmentsForRequest,
  updateToolCallResult,
} from "@ai-sdk/ui-utils";
import {
  fromUIMessage,
  getLogger,
  prompts,
  toUIMessages,
} from "@ragdoll/common";
import {
  isAssistantMessageWithEmptyParts,
  isAssistantMessageWithNoToolCalls,
  isAssistantMessageWithPartialToolCalls,
  prepareLastMessageForRetry,
} from "@ragdoll/common/message-utils";
import { findTodos, mergeTodos } from "@ragdoll/common/todo-utils";
import type { DB, Environment, TaskEvent, Todo } from "@ragdoll/db";
import type { AppType, PochiEventSource } from "@ragdoll/server";
import {
  ServerToolApproved,
  ServerTools,
  type ToolFunctionType,
  isUserInputTool,
} from "@ragdoll/tools";
import type { CreateMessage, Message, ToolInvocation, UIMessage } from "ai";
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
export type Task = Awaited<ReturnType<TaskRunner["loadTask"]>>;

export interface RunnerContext {
  /**
   * The current working directory for the task runner.
   * This is used to determine where to read/write files and execute commands.
   * It should be an absolute path.
   */
  cwd: string;

  /**
   * The llm model to use for the task runner.
   */
  model?: string;

  /**
   * The path to the ripgrep executable.
   * This is used for searching files in the task runner.
   */
  rg: string;
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
      task: Task;
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
    }
  | {
      type: "runner-stopped";
      status: TaskStatus | undefined;
      result?: string;
      error?: string;
    };

export type TaskRunnerProgress = TaskStepProgress & { step: number };

export class TaskRunner {
  private todos: Todo[] = [];
  private readonly retryLimit = 5;
  private retryCount = 0;
  private abortController?: AbortController;

  constructor(
    private readonly apiClient: ApiClient,
    private readonly pochiEvents: PochiEventSource,
    private readonly uid: string,
    private readonly context: RunnerContext,
  ) {}

  private async buildEnvironment(): Promise<Environment> {
    const environment = await readEnvironment(this.context);
    return {
      ...environment,
      todos: this.todos,
    };
  }

  private updateTodos(todos: Todo[] = []) {
    // Update the context todos with the new todos
    this.todos = mergeTodos(this.todos, todos);
  }

  private async *retry(
    messages: UIMessage[],
  ): AsyncGenerator<TaskStepProgress> {
    if (this.retryCount >= this.retryLimit) {
      logger.error(
        "Retry limit reached for task",
        this.uid,
        "with messages",
        messages,
      );
      return yield {
        type: "step-completed",
        status: "failed",
      };
    }
    this.retryCount++;

    logger.trace("Retrying task", this.uid, "with messages", messages);
    const reload = async function* (
      this: TaskRunner,
    ): AsyncGenerator<TaskStepProgress> {
      // Remove last assistant message and retry last user message.
      const lastMessage = getLastMessage(messages);
      const newMessages =
        lastMessage.role === "assistant" ? messages.slice(0, -1) : messages;
      return yield* this.streamMessage(newMessages);
    }.bind(this);

    const append = async function* (
      this: TaskRunner,
      message: Message | CreateMessage,
    ): AsyncGenerator<TaskStepProgress> {
      const attachmentsForRequest = await prepareAttachmentsForRequest(
        message.experimental_attachments,
      );
      const lastMessage = {
        ...message,
        id: message.id ?? generateId(),
        createdAt: message.createdAt ?? new Date(),
        experimental_attachments:
          attachmentsForRequest.length > 0 ? attachmentsForRequest : undefined,
        parts: getMessageParts(message),
      };
      return yield* this.streamMessage([...messages, lastMessage]);
    }.bind(this);

    const lastMessage = getLastMessage(messages);
    if (lastMessage.role !== "assistant") {
      return yield* reload();
    }

    if (isAssistantMessageWithNoToolCalls(lastMessage)) {
      return yield* append({
        role: "user",
        content: prompts.createUserReminder(
          "You should use tool calls to answer the question, for example, use attemptCompletion if the job is done, or use askFollowupQuestions to clarify the request.",
        ),
      });
    }

    const lastMessageForRetry = prepareLastMessageForRetry(lastMessage);
    if (lastMessageForRetry != null) {
      return yield* append(lastMessageForRetry);
    }

    return yield* reload();
  }

  private async *streamMessage(
    messages: UIMessage[],
  ): AsyncGenerator<TaskStepProgress> {
    const lastMessage = getLastMessage(messages);
    const streamDone = new Promise<TaskStatus>((resolve) => {
      let streamingStarted = false;
      const unsubscribe = this.pochiEvents.subscribe<TaskEvent>(
        "task:status-changed",
        ({ data }) => {
          if (data.uid !== this.uid) {
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
            `Unexpected task status change: ${data.status} for task ${data.uid}`,
          );
        },
      );
    });

    const environment = await this.buildEnvironment();
    logger.debug("Starting streaming for task", this.uid);

    yield { type: "sending-result", phase: "begin", message: lastMessage };
    const resp = await this.apiClient.api.chat.stream.$post(
      {
        json: {
          id: this.uid,
          message: fromUIMessage(lastMessage),
          environment,
          model: this.context.model,
        },
      },
      {
        init: {
          signal: this.abortController?.signal,
        },
      },
    );

    if (!resp.ok) {
      const error = await resp.text();
      logger.error(`Failed to start streaming ${resp.statusText}: ${error}`);
      return yield* this.retry(messages);
    }
    yield { type: "sending-result", phase: "end" };

    const status = await streamDone;
    yield {
      type: "step-completed",
      status,
    };
  }

  private async executeToolCall(
    tool: ToolInvocation,
    abortSignal?: AbortSignal,
  ) {
    if (tool.toolName in ServerTools) {
      return ServerToolApproved;
    }
    if (tool.state !== "call") {
      throw new Error(`Tool invocation is not in call state: ${tool.state}`);
    }
    const toolFunction = ToolMap[tool.toolName];
    if (!toolFunction) {
      return {
        error: `Tool ${tool.toolName} not found.`,
      };
    }

    logger.trace(
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
        abortSignal,
      }),
    );
  }

  /**
   * @yields {@link TaskStepProgress} - Progress updates
   * @throws {@link Error} if the task is in an invalid state, or any error occurs during execution
   */
  private async *step(): AsyncGenerator<TaskStepProgress> {
    yield { type: "loading-task", phase: "begin" };
    let task = await this.loadTask();

    if (task.status === "streaming") {
      task = await this.waitAndReloadTask();
    }
    yield { type: "loading-task", phase: "end", task };

    if (task.status === "completed") {
      yield {
        type: "runner-stopped",
        status: "completed",
        result: getTaskResult(task),
      };
      return;
    }

    // We're only abled to handle "error" / tool-call
    const messages = toUIMessages(task.conversation?.messages || []);
    const lastMessage = getLastMessage(messages);

    if (hasUserInputTool(lastMessage) && task.status === "pending-input") {
      yield { type: "runner-stopped", status: "pending-input" };
      return;
    }

    if (isReadyForRetry(lastMessage)) {
      return yield* this.retry(messages);
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
      const toolResult = await this.executeToolCall(
        nextToolCall,
        this.abortController?.signal,
      );

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
    return yield* this.streamMessage(messages);
  }

  /**
   * Start the task runner and yield progress updates
   * @yields {@link TaskRunnerProgress} - Progress updates throughout task execution
   */
  async *start(): AsyncGenerator<TaskRunnerProgress> {
    this.abortController = new AbortController();
    let step = 0;
    while (true) {
      for await (const progress of this.step()) {
        if (this.abortController.signal.aborted) {
          yield {
            type: "runner-stopped",
            status: "failed",
            error: "Task execution aborted by user",
            step,
          };
          return;
        }
        if (progress.type === "runner-stopped") {
          yield {
            ...progress,
            step,
          };
          return;
        }
        yield { ...progress, step };
      }
      step++;
    }
  }

  stop() {
    this.abortController?.abort();
  }

  private async loadTask() {
    const resp = await this.apiClient.api.tasks[":uid"].$get({
      param: {
        uid: this.uid,
      },
    });

    if (!resp.ok) {
      throw new Error(`Failed to fetch task: ${resp.statusText}`);
    }

    return await resp.json();
  }

  private async waitAndReloadTask() {
    return new Promise<Task>((resolve, reject) => {
      const cleanups: (() => void)[] = [];
      const cleanupAndResolve = (task: Task | Promise<Task>) => {
        for (const cleanup of cleanups) {
          cleanup();
        }
        resolve(task);
      };
      const cleanupAndReject = (error: Error) => {
        for (const cleanup of cleanups) {
          cleanup();
        }
        reject(error);
      };

      // Try reloading the task directly
      this.loadTask()
        .then((task) => {
          if (task.status !== "streaming") {
            cleanupAndResolve(task);
          }
        })
        .catch(() => {
          // ignore
        });

      // Subscribe to task status changes
      const unsubscribe = this.pochiEvents.subscribe<TaskEvent>(
        "task:status-changed",
        ({ data }) => {
          if (data.uid !== this.uid) {
            return;
          }

          if (data.status !== "streaming") {
            cleanupAndResolve(this.loadTask());
          }
        },
      );
      cleanups.push(unsubscribe);

      // Set a timeout to reload the task and reject if it is still streaming
      const timer = setTimeout(() => {
        unsubscribe();
        this.loadTask()
          .then((task) => {
            if (task.status !== "streaming") {
              cleanupAndResolve(task);
            } else {
              cleanupAndReject(
                new Error(`Task ${this.uid} is still streaming after timeout.`),
              );
            }
          })
          .catch((error) => {
            cleanupAndReject(error);
          });
      }, 120_000); // 120 seconds timeout
      cleanups.push(() => {
        clearTimeout(timer);
      });
    });
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

function getLastMessage(messages: UIMessage[]): UIMessage {
  const lastMessage = messages.at(-1);
  if (!lastMessage) {
    throw new Error("No messages found");
  }
  return lastMessage;
}

function isReadyForRetry(lastMessage: UIMessage): boolean {
  return (
    lastMessage.role === "user" ||
    isAssistantMessageWithNoToolCalls(lastMessage) ||
    isAssistantMessageWithEmptyParts(lastMessage) ||
    isAssistantMessageWithPartialToolCalls(lastMessage) ||
    isAssistantMessageWithCompletedToolCalls(lastMessage)
  );
}

function hasUserInputTool(message: Message): boolean {
  if (message.role !== "assistant") {
    return false;
  }

  return !!message.parts?.some(
    (part) =>
      part.type === "tool-invocation" &&
      isUserInputTool(part.toolInvocation.toolName),
  );
}

/**
 * Get task execution result from last attemptCompletion tool args
 * @param messages task messages
 * @returns
 */
export function getTaskResult(task: Task) {
  const messages = toUIMessages(task.conversation?.messages || []);
  const lastMessage = messages.at(-1);
  if (!lastMessage) {
    return;
  }

  if (lastMessage.role !== "assistant") {
    return;
  }
  const part = lastMessage.parts.findLast(
    (
      part,
    ): part is ToolInvocationUIPart & {
      toolInvocation: { state: "result" };
    } =>
      part.type === "tool-invocation" &&
      part.toolInvocation.toolName === "attemptCompletion",
  );
  if (part) {
    return part.toolInvocation.args.result;
  }
}
