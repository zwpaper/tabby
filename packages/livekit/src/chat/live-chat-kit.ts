import {
  APICallError,
  type ChatInit,
  type ChatOnErrorCallback,
  type ChatOnFinishCallback,
  InvalidToolInputError,
  NoSuchToolError,
  getToolName,
  isToolUIPart,
} from "@ai-v5-sdk/ai";
import { isAbortError } from "@ai-v5-sdk/provider-utils";
import { isUserInputTool } from "@getpochi/tools";
import type { Store } from "@livestore/livestore";
import { makeMessagesQuery, makeTaskQuery } from "../livestore/queries";
import { events, tables } from "../livestore/schema";
import type { Message } from "../types";
import {
  FlexibleChatTransport,
  type OnStartCallback,
  type PrepareRequestDataCallback,
} from "./flexible-chat-transport";

export type LiveChatKitOptions<T> = {
  taskId: string;
  store: Store;
  chatClass: new (options: ChatInit<Message>) => T;
  prepareRequestData: PrepareRequestDataCallback;
} & Omit<
  ChatInit<Message>,
  "id" | "messages" | "generateId" | "onFinish" | "onError" | "transport"
>;

export class LiveChatKit<T> {
  protected readonly taskId: string;
  protected readonly store: Store;
  readonly chat: T;
  private readonly transport: FlexibleChatTransport;

  constructor({
    taskId,
    store,
    chatClass,
    prepareRequestData,
    ...chatInit
  }: LiveChatKitOptions<T>) {
    this.taskId = taskId;
    this.store = store;
    this.transport = new FlexibleChatTransport({
      onStart: this.onStart,
      prepareRequestData,
    });

    this.chat = new chatClass({
      ...chatInit,
      id: taskId,
      messages: this.messages,
      generateId: () => crypto.randomUUID(),
      onFinish: this.onFinish,
      onError: this.onError,
      transport: this.transport,
      // sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    });
  }

  get task() {
    return this.store.query(makeTaskQuery(this.taskId));
  }

  get messages() {
    return this.store
      .query(makeMessagesQuery(this.taskId))
      .map((x) => x.data as Message);
  }

  private readonly onStart: OnStartCallback = ({ messages, environment }) => {
    const { store } = this;
    const lastMessage = messages.at(-1);
    if (lastMessage) {
      const countTask = store.query(
        tables.tasks.where("id", "=", this.taskId).count(),
      );
      if (countTask === 0) {
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
    store.commit(
      events.chatStreamFinished({
        id: this.taskId,
        status: toTaskStatus(message),
        data: message,
        totalTokens: message.metadata?.totalTokens || null,
        updatedAt: new Date(),
      }),
    );
  };

  private readonly onError: ChatOnErrorCallback = (error) => {
    this.store.commit(
      events.chatStreamFailed({
        id: this.taskId,
        error: toTaskError(error),
        updatedAt: new Date(),
      }),
    );
  };
}

function toTaskStatus(message: Message): (typeof tables.tasks.Type)["status"] {
  const { finishReason } = message.metadata || {};
  if (!finishReason) return "failed";

  if (finishReason === "tool-calls") {
    if (message.parts.some((x) => x.type === "tool-attemptCompletion")) {
      return "completed";
    }

    if (
      message.parts.some(
        (x) => isToolUIPart(x) && isUserInputTool(getToolName(x)),
      )
    ) {
      return "pending-input";
    }

    return "pending-tool";
  }

  if (finishReason === "stop") {
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
