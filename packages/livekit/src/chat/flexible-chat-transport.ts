import {
  type ChatRequestOptions,
  type ChatTransport,
  type UIMessage,
  type UIMessageChunk,
  convertToModelMessages,
  streamText,
} from "@ai-v5-sdk/ai";
import { createOpenAICompatible } from "@ai-v5-sdk/openai-compatible";
import { ClientToolsV5 } from "@getpochi/tools";
import { formatters, prompts } from "@ragdoll/common";
import type { Environment } from "@ragdoll/db";
import type { Message, RequestData } from "../types";
import { fromV4UIMessage, toV4UIMessage } from "../v4-adapter";

export type OnStartCallback = (options: {
  messages: UIMessage[];
  environment?: Environment;
}) => void;

export type PrepareRequestDataCallback = () =>
  | RequestData
  | Promise<RequestData>;

export class FlexibleChatTransport implements ChatTransport<UIMessage> {
  private readonly onStart?: OnStartCallback;
  private readonly prepareRequestData: PrepareRequestDataCallback;

  constructor(options: {
    onStart?: OnStartCallback;
    prepareRequestData: PrepareRequestDataCallback;
  }) {
    this.onStart = options.onStart;
    this.prepareRequestData = options.prepareRequestData;
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
    abortSignal,
  }) => {
    const { environment, llm } = await this.prepareRequestData();

    this.onStart?.({
      messages,
      environment,
    });
    const result = streamText({
      abortSignal,
      model: createModel(llm),
      messages: await prepareMessages(
        // @ts-expect-error: Force type conversion to Message.
        messages as Message,
        environment,
      ),
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

async function prepareMessages(
  inputMessages: Message[],
  environment: Environment | undefined,
) {
  const messages = prompts.injectEnvironmentDetails(
    inputMessages.map(toV4UIMessage),
    environment,
    // FIXME(meng): set user from git config
    undefined,
  );

  const llmMessages = formatters.llmRaw(messages);

  return convertToModelMessages(
    await Promise.all(llmMessages.map(fromV4UIMessage)),
  );
}

function createModel(llm: RequestData["llm"]) {
  const openai = createOpenAICompatible({
    name: "BYOK",
    baseURL: llm.baseURL,
    apiKey: llm.apiKey,
  });

  return openai(llm.modelId);
}
