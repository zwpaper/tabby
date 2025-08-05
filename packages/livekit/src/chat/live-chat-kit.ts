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
import type { catalog } from "..";
import { messages$, task$ } from "../livestore/queries";
import { events, type tables } from "../livestore/schema";
import type { Message } from "../types";
import {
  FlexibleChatTransport,
  type OnStartCallback,
} from "./flexible-chat-transport";

type LiveChatKitOptions<T> = {
  store: Store;
  chatClass: new (options: ChatInit<Message>) => T;
};

export class LiveChatKitBase<T> {
  protected readonly store: Store;
  readonly chat: T;

  constructor({ store, chatClass }: LiveChatKitOptions<T>) {
    this.store = store;
    this.store.commit(events.taskInited({ createdAt: new Date() }));

    this.chat = new chatClass({
      messages: this.messages,
      generateId: () => crypto.randomUUID(),
      onFinish: this.onFinish,
      onError: this.onError,
      transport: this.transport,
    });
  }

  get task() {
    const task = this.store.query(task$);
    return this.getTaskWithId(task);
  }

  protected getTaskWithId(task: typeof catalog.tables.task.Type) {
    return {
      ...task,
      id: this.store.storeId,
    };
  }

  get messages() {
    return this.store.query(messages$).map((x) => x.data as Message);
  }

  private readonly onStart: OnStartCallback = ({ messages, todos }) => {
    const { store } = this;
    const lastMessage = messages.at(-1);
    if (lastMessage) {
      store.commit(
        events.chatStreamStarted({
          data: lastMessage,
          todos,
          updatedAt: new Date(),
        }),
      );
    }
  };

  private readonly transport = new FlexibleChatTransport({
    onStart: this.onStart,
  });

  private readonly onFinish: ChatOnFinishCallback<Message> = ({ message }) => {
    const { store } = this;
    store.commit(
      events.chatStreamFinished({
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
        error: toTaskError(error),
        updatedAt: new Date(),
      }),
    );
  };
}

function toTaskStatus(message: Message): (typeof tables.task.Type)["status"] {
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
): NonNullable<(typeof tables.task.Type)["error"]> {
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
