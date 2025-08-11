import type {
  ChatRequestOptions,
  ChatTransport,
  UIMessageChunk,
} from "@ai-v5-sdk/ai";
import type { McpTool } from "@getpochi/tools";
import type { Store } from "@livestore/livestore";
import { formattersNext, prompts } from "@ragdoll/common";
import type { Environment } from "@ragdoll/db";
import type { Message, RequestData } from "../types";
import { requestLLM } from "./llm";
import {
  createBatchCallMiddleware,
  createNewTaskMiddleware,
  createReasoningMiddleware,
  createToolCallMiddleware,
} from "./middlewares";

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

    const middlewares = [
      createNewTaskMiddleware(this.store, chatId),
      createBatchCallMiddleware(),
    ];

    if (isWellKnownReasoningModel(llm.modelId)) {
      middlewares.push(createReasoningMiddleware());
    }

    if (llm.type === "pochi") {
      middlewares.push(createToolCallMiddleware());
    }

    const system = prompts.system(environment?.info?.customRules);
    return requestLLM(chatId, llm, {
      system,
      messages: prepareMessages(messages, environment),
      abortSignal,
      id: chatId,
      mcpToolSet,
      middlewares,
    });
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

function isWellKnownReasoningModel(model?: string): boolean {
  if (!model) return false;

  const models = [/glm-4.5/, /qwen3.*thinking/];
  const x = model.toLowerCase();
  for (const m of models) {
    if (x.match(m)?.length) {
      return true;
    }
  }
  return false;
}
