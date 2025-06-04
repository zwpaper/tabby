import {
  isAssistantMessageWithCompletedToolCalls,
  updateToolCallResult,
} from "@ai-sdk/ui-utils";
import {
  type TaskEvent,
  fromUIMessage,
  getLogger,
  toUIMessages,
} from "@ragdoll/common";
import type { DB } from "@ragdoll/db";
import type { ToolFunctionType } from "@ragdoll/tools";
import type { ToolInvocation, UIMessage } from "ai";
import { apiClient, pochiEvents } from "./lib/api-client";
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

const ToolMap: Record<
  string,
  // biome-ignore lint/suspicious/noExplicitAny: external call without type information
  ToolFunctionType<any>
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

export class TaskRunner {
  constructor(private readonly taskId: number) {}

  private async step(): Promise<TaskStatus> {
    const task = await this.loadTask();
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

    while (
      lastMessage.role === "assistant" &&
      !isAssistantMessageWithCompletedToolCalls(lastMessage)
    ) {
      const nextToolCall = findNextToolCall(lastMessage);
      if (!nextToolCall) {
        throw new Error("No tool call found");
      }

      const toolResult = await this.executeToolCall(nextToolCall);

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
      const unsubscribe = pochiEvents.subscribe<TaskEvent>(
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

    // Start streaming
    const resp = await apiClient.api.chat.stream.$post(
      {
        json: {
          id: this.taskId.toString(),
          message: fromUIMessage(lastMessage),
          // FIXME: fill environment
          environment: undefined,
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

    return streamDone;
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

    logger.info("Executing tool", tool.toolName, "with args", tool.args);
    return await safeCall(
      toolFunction(tool.args, {
        messages: [],
        toolCallId: tool.toolCallId,
      }),
    );
  }

  async start() {
    while (true) {
      const status = await this.step();
      if (status !== "pending-tool") {
        return status;
      }
    }
  }

  async loadTask() {
    const resp = await apiClient.api.tasks[":id"].$get({
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
