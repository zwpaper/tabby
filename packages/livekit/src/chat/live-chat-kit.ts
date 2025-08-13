import {
  APICallError,
  type ChatInit,
  type ChatOnErrorCallback,
  type ChatOnFinishCallback,
  InvalidToolInputError,
  NoSuchToolError,
  isToolUIPart,
} from "@ai-v5-sdk/ai";
import { isAbortError } from "@ai-v5-sdk/provider-utils";
import type { Environment } from "@getpochi/base";
import type { McpTool } from "@getpochi/tools";
import type { Store } from "@livestore/livestore";
import type { LLMRequestData } from "..";
import { makeMessagesQuery, makeTaskQuery } from "../livestore/queries";
import { events, tables } from "../livestore/schema";
import type { Message } from "../types";
import { compactTask } from "./compact-task";
import {
  FlexibleChatTransport,
  type OnStartCallback,
} from "./flexible-chat-transport";

export type LiveChatKitOptions<T> = {
  taskId: string;

  // Request related getters
  getters: {
    getLLM: () => LLMRequestData;
    getEnvironment?: (options: {
      readonly messages: Message[];
    }) => Promise<Environment>;
    getMcpTools?: () => Record<string, McpTool>;
  };
  allowNewTask?: boolean;

  store: Store;
  chatClass: new (options: ChatInit<Message>) => T;
  onBeforeMakeRequest?: (options: {
    messages: Message[];
  }) => void | Promise<void>;
} & Omit<
  ChatInit<Message>,
  "id" | "messages" | "generateId" | "onFinish" | "onError" | "transport"
>;

export class LiveChatKit<T extends { messages: Message[] }> {
  protected readonly taskId: string;
  protected readonly store: Store;
  readonly chat: T;
  private readonly transport: FlexibleChatTransport;

  constructor({
    taskId,
    store,
    chatClass,
    onBeforeMakeRequest,
    getters,
    allowNewTask,
    ...chatInit
  }: LiveChatKitOptions<T>) {
    this.taskId = taskId;
    this.store = store;
    this.transport = new FlexibleChatTransport({
      store,
      onStart: this.onStart,
      getters,
      allowNewTask,
    });

    this.chat = new chatClass({
      ...chatInit,
      id: taskId,
      messages: this.messages,
      generateId: () => crypto.randomUUID(),
      onFinish: this.onFinish,
      onError: this.onError,
      transport: this.transport,
    });

    // @ts-expect-error: monkey patch
    const chat = this.chat as {
      makeRequest: (...args: unknown[]) => Promise<unknown>;
      setStatus: (status: { status: string; error?: unknown }) => void;
    };

    const originMakeRequest = chat.makeRequest;
    chat.makeRequest = async (...args) => {
      // Mark status to make async behaivor blocked based on status (e.g isLoading )
      const { messages } = this.chat;
      const lastMessage = messages.at(-1);
      if (lastMessage?.role === "user") {
        await compactTask({
          messages,
          getLLM: getters.getLLM,
          overwrite: true,
        });
      }
      if (onBeforeMakeRequest) {
        await onBeforeMakeRequest({ messages });
      }
      return originMakeRequest.apply(chat, args);
    };

    this.spawn = async () => {
      const { messages } = this.chat;
      const summary = await compactTask({
        messages,
        getLLM: getters.getLLM,
        overwrite: false,
      });
      if (!summary) {
        throw new Error("Failed to compact task");
      }

      const taskId = crypto.randomUUID();
      this.store.commit(
        events.taskInited({
          id: taskId,
          createdAt: new Date(),
          initMessage: {
            id: crypto.randomUUID(),
            parts: [
              {
                type: "text",
                text: summary,
              },

              {
                type: "text",
                text: "I've summarized the task and start a new task with the summary. Please analysis the current status, and use askFollowUpQuestion with me to confirm the next steps",
              },
            ],
          },
        }),
      );
      return taskId;
    };
  }

  init(prompt: string) {
    this.store.commit(
      events.taskInited({
        id: this.taskId,
        createdAt: new Date(),
        initMessage: {
          id: crypto.randomUUID(),
          parts: [
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      }),
    );

    // Sync the chat messages.
    this.chat.messages = this.messages;
  }

  get task() {
    return this.store.query(makeTaskQuery(this.taskId));
  }

  get messages() {
    return this.store
      .query(makeMessagesQuery(this.taskId))
      .map((x) => x.data as Message);
  }

  // Create a new task by compacting from current task, returns new taskId.
  readonly spawn: () => Promise<string>;

  get inited() {
    const countTask = this.store.query(
      tables.tasks.where("id", "=", this.taskId).count(),
    );
    return countTask > 0;
  }

  private readonly onStart: OnStartCallback = ({ messages, environment }) => {
    const { store } = this;
    const lastMessage = messages.at(-1);
    if (lastMessage) {
      if (!this.inited) {
        store.commit(
          events.taskInited({
            id: this.taskId,
            createdAt: new Date(),
          }),
        );
      }

      const { gitStatus } = environment?.workspace || {};

      store.commit(
        events.chatStreamStarted({
          id: this.taskId,
          data: lastMessage,
          todos: environment?.todos || [],
          git: gitStatus
            ? {
                origin: gitStatus.origin,
                branch: gitStatus.currentBranch,
              }
            : undefined,
          updatedAt: new Date(),
        }),
      );
    }
  };

  private readonly onFinish: ChatOnFinishCallback<Message> = ({ message }) => {
    const { store } = this;
    if (message.metadata?.kind !== "assistant") {
      const error = new Error("Transport is aborted");
      error.name = "AbortError";
      throw error;
    }

    store.commit(
      events.chatStreamFinished({
        id: this.taskId,
        status: toTaskStatus(message, message.metadata),
        data: message,
        totalTokens: message.metadata.totalTokens,
        updatedAt: new Date(),
      }),
    );
  };

  private readonly onError: ChatOnErrorCallback = (error) => {
    console.error("onError", error);
    const lastMessage = this.chat.messages.at(-1) || null;
    this.store.commit(
      events.chatStreamFailed({
        id: this.taskId,
        error: toTaskError(error),
        data: lastMessage,
        updatedAt: new Date(),
      }),
    );
  };
}

function toTaskStatus(
  message: Message,
  metadata: Extract<NonNullable<Message["metadata"]>, { kind: "assistant" }>,
): (typeof tables.tasks.Type)["status"] {
  const lastStepStart = message.parts.findLastIndex(
    (x) => x.type === "step-start",
  );

  const { finishReason } = metadata;
  if (!finishReason) return "failed";

  for (const part of message.parts.slice(lastStepStart + 1)) {
    if (
      part.type === "tool-askFollowupQuestion" ||
      part.type === "tool-attemptCompletion"
    ) {
      return "completed";
    }

    if (isToolUIPart(part)) {
      return "pending-tool";
    }
  }

  if (finishReason !== "error") {
    return "pending-input";
  }

  return "failed";
}

function toTaskError(
  error: unknown,
): NonNullable<(typeof tables.tasks.Type)["error"]> {
  if (APICallError.isInstance(error)) {
    return {
      kind: "APICallError",
      message: error.message,
      requestBodyValues: error.requestBodyValues,
    };
  }

  const internalError = (message: string) => {
    return {
      kind: "InternalError",
      message,
    } as const;
  };

  if (InvalidToolInputError.isInstance(error)) {
    return internalError(
      `Invalid arguments provided to tool "${error.toolName}". Please try again.`,
    );
  }

  if (NoSuchToolError.isInstance(error)) {
    return internalError(`${error.toolName} is not a valid tool.`);
  }

  if (isAbortError(error)) {
    return {
      kind: "AbortError",
      message: error.message,
    };
  }

  if (!(error instanceof Error)) {
    return internalError(
      `Something went wrong. Please try again: ${JSON.stringify(error)}`,
    );
  }

  return internalError(error.message);
}
