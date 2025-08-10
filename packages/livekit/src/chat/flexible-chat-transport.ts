import type {
  ChatRequestOptions,
  ChatTransport,
  InferToolInput,
  UIMessageChunk,
} from "@ai-v5-sdk/ai";
import type { ClientToolsV5Type, McpTool } from "@getpochi/tools";
import type { Store } from "@livestore/livestore";
import { formattersNext, prompts } from "@ragdoll/common";
import type { Environment } from "@ragdoll/db";
import { events } from "../livestore/schema";
import type { Message, RequestData } from "../types";
import { requestLLM } from "./llm";

export type OnStartCallback = (options: {
  messages: Message[];
  environment?: Environment;
}) => void;

export type PrepareRequestGetters = {
  getLLM: () => RequestData["llm"];
  getEnvironment?: (options: {
    readonly messages: Message[];
  }) => Promise<Environment>;
  getMcpToolSet?: () => Record<string, McpTool>;
};

export class FlexibleChatTransport implements ChatTransport<Message> {
  private readonly onStart?: OnStartCallback;
  private readonly getters: PrepareRequestGetters;
  private readonly store: Store;

  constructor(options: {
    onStart?: OnStartCallback;
    getters: PrepareRequestGetters;
    store: Store;
  }) {
    this.onStart = options.onStart;
    this.getters = options.getters;
    this.store = options.store;
  }

  sendMessages: (
    options: {
      trigger: "submit-message" | "regenerate-message";
      chatId: string;
      messageId: string | undefined;
      messages: Message[];
      abortSignal: AbortSignal | undefined;
    } & ChatRequestOptions,
  ) => Promise<ReadableStream<UIMessageChunk>> = async ({
    chatId,
    messages,
    abortSignal,
  }) => {
    const llm = await this.getters.getLLM();
    const environment = await this.getters.getEnvironment?.({ messages });
    const mcpToolSet = this.getters.getMcpToolSet?.();

    this.onStart?.({
      messages,
      environment,
    });

    const system = prompts.system(environment?.info?.customRules);
    let stream = await requestLLM(llm, {
      system,
      messages: prepareMessages(messages, environment),
      abortSignal,
      id: chatId,
      mcpToolSet,
    });

    const middlewares = [newTaskMiddleware(this.store, chatId)];
    for (const middleware of middlewares) {
      stream = middleware(stream);
    }

    return stream;
  };

  reconnectToStream: (
    options: { chatId: string } & ChatRequestOptions,
  ) => Promise<ReadableStream<UIMessageChunk> | null> = async () => {
    return null;
  };
}

function prepareMessages<T extends import("@ai-v5-sdk/ai").UIMessage>(
  inputMessages: T[],
  environment: Environment | undefined,
): T[] {
  const messages = prompts.injectEnvironmentDetailsNext(
    inputMessages,
    environment,
  );

  return formattersNext.llm(messages) as T[];
}

function newTaskMiddleware(store: Store, parentTaskId: string) {
  return (stream: ReadableStream<UIMessageChunk>) => {
    let toolCallId = "";
    return stream.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          if (
            chunk.type === "tool-input-start" &&
            chunk.toolName === "newTask"
          ) {
            toolCallId = chunk.toolCallId;
            return;
          }

          if (
            chunk.type === "tool-input-delta" &&
            chunk.toolCallId === toolCallId
          ) {
            return;
          }

          if (
            chunk.type === "tool-input-available" &&
            chunk.toolCallId === toolCallId
          ) {
            const arg = chunk.input as InferToolInput<
              ClientToolsV5Type["newTask"]
            >;
            const uid = crypto.randomUUID();
            arg._meta = {
              uid,
            };
            store.commit(
              events.taskInited({
                id: uid,
                parentId: parentTaskId,
                createdAt: new Date(),
                initMessage: {
                  id: crypto.randomUUID(),
                  parts: [
                    {
                      type: "text",
                      text: arg.prompt,
                    },
                  ],
                },
              }),
            );

            controller.enqueue({
              ...chunk,
            });
            toolCallId = "";
            return;
          }

          controller.enqueue(chunk);
        },
      }),
    );
  };
}
