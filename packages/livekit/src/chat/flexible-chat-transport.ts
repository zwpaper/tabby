import type {
  ChatRequestOptions,
  ChatTransport,
  UIMessageChunk,
} from "@ai-v5-sdk/ai";
import type { Environment } from "@getpochi/base";
import { type McpTool, selectClientToolsNext } from "@getpochi/tools";
import type { Store } from "@livestore/livestore";
import { formattersNext, prompts } from "@ragdoll/common";
import type { Message, RequestData } from "../types";
import { requestLLM } from "./llm";
import { parseMcpToolSet } from "./llm/utils";
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
  private readonly allowNewTask?: boolean;
  private readonly store: Store;

  constructor(options: {
    onStart?: OnStartCallback;
    getters: PrepareRequestGetters;
    allowNewTask?: boolean;
    store: Store;
  }) {
    this.onStart = options.onStart;
    this.getters = options.getters;
    this.allowNewTask = options.allowNewTask;
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

    const middlewares = [];

    if (this.allowNewTask) {
      middlewares.push(createNewTaskMiddleware(this.store, chatId));
    }

    middlewares.push(createBatchCallMiddleware());

    if (isWellKnownReasoningModel(llm.modelId)) {
      middlewares.push(createReasoningMiddleware());
    }

    if (
      llm.type === "pochi" &&
      // Turn on ToolCallMiddleware only for gemini backed models for now
      (llm.modelId?.startsWith("google/") || llm.modelId?.startsWith("pochi/"))
    ) {
      middlewares.push(createToolCallMiddleware());
    }

    const system = prompts.system(environment?.info?.customRules);
    const mcpTools = mcpToolSet && parseMcpToolSet(mcpToolSet);
    const tools = {
      ...selectClientToolsNext(!!this.allowNewTask),
      ...(mcpTools || {}),
    };
    return requestLLM(this.store, chatId, llm, {
      system,
      messages: prepareMessages(messages, environment),
      abortSignal,
      id: chatId,
      tools,
      middlewares,
      environment,
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
