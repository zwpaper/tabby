import {
  isAssistantMessageWithCompletedToolCalls,
  updateToolCallResult,
} from "@ai-sdk/ui-utils";
import { type TaskEvent, fromUIMessage, toUIMessages } from "@ragdoll/common";
import type { DB } from "@ragdoll/db";
import type { ToolInvocation, UIMessage } from "ai";
import { apiClient, pochiEvents } from "./lib/api-client";

type TaskStatus = DB["task"]["status"]["__select__"];

export class TaskRunner {
  constructor(private readonly taskId: number) {}

  private async step(): Promise<TaskStatus> {
    const task = await this.loadTask();
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

    while (!isAssistantMessageWithCompletedToolCalls(lastMessage)) {
      const nextToolCall = findNextToolCall(lastMessage);
      if (!nextToolCall) {
        throw new Error("No tool call found");
      }

      // FIXME: actually execute tool call.
      const toolResult = await (async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return {
          success: true,
        };
      })();

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
          }

          if (data.status !== "streaming" && streamingStarted) {
            unsubscribe();
            resolve(data.status);
          }

          throw new Error(
            `Unexpected task status change: ${data.status} for task ${data.taskId}`,
          );
        },
      );
    });

    // Start streaming
    apiClient.api.chat.stream.$post(
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

    return streamDone;
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
      throw new Error("Failed to fetch task");
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
