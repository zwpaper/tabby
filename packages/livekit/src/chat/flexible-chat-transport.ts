import {
  type ChatRequestOptions,
  type ChatTransport,
  type UIMessage,
  type UIMessageChunk,
  convertToModelMessages,
  streamText,
} from "@ai-v5-sdk/ai";
import { createOpenAICompatible } from "@ai-v5-sdk/openai-compatible";
import { ClientToolsV5, type Todo } from "@getpochi/tools";
import { prompts } from "@ragdoll/common";
import type { Environment } from "@ragdoll/db";
import { type RequestMetadata, ZodRequestMetadata } from "../types";

export type OnStartCallback = (options: {
  messages: UIMessage[];
  todos: Todo[];
}) => void;

export class FlexibleChatTransport implements ChatTransport<UIMessage> {
  readonly onStart?: OnStartCallback;

  constructor({
    onStart,
  }: {
    onStart?: OnStartCallback;
  }) {
    this.onStart = onStart;
  }

  sendMessages: (
    options: {
      trigger: "submit-message" | "regenerate-message";
      chatId: string;
      messageId: string | undefined;
      messages: UIMessage[];
      abortSignal: AbortSignal | undefined;
    } & ChatRequestOptions,
  ) => Promise<ReadableStream<UIMessageChunk>> = async ({
    messages,
    ...options
  }) => {
    const { environment, llm } = ZodRequestMetadata.parse(options.metadata);

    this.onStart?.({
      messages,
      todos: environment?.todos || [],
    });
    const result = streamText({
      model: createModel(llm),
      messages: prepareMessages(messages, environment),
      tools: ClientToolsV5,
      system: prompts.system(environment?.info?.customRules),
      maxOutputTokens: llm.maxOutputTokens,
      maxRetries: 0,
    });
    return result.toUIMessageStream({
      messageMetadata: ({ part }) => {
        if (part.type === "finish") {
          return {
            totalTokens: part.totalUsage.totalTokens,
            finishReason: part.finishReason,
          };
        }
      },
    });
  };

  reconnectToStream: (
    options: { chatId: string } & ChatRequestOptions,
  ) => Promise<ReadableStream<UIMessageChunk> | null> = async () => {
    return null;
  };
}

function prepareMessages(
  inputMessages: UIMessage[],
  environment: Environment | undefined,
) {
  // @ts-expect-error from an injectEnvironmentDetails perspective, v4 / v5 UIMessage are compatible, we can safely ignore type error.
  const messages: UIMessage[] = prompts.injectEnvironmentDetails(
    // @ts-expect-error from an injectEnvironmentDetails perspective, v4 / v5 UIMessage are compatible, we can safely ignore type error.
    inputMessages,
    environment,
    // FIXME(meng): set user from git config
    undefined,
  );

  return convertToModelMessages(messages);
}

function createModel(llm: RequestMetadata["llm"]) {
  const openai = createOpenAICompatible({
    name: "BYOK",
    baseURL: llm.baseURL,
    apiKey: llm.apiKey,
  });

  return openai(llm.modelId);
}
