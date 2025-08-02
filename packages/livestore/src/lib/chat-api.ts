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

const openai = createOpenAICompatible({
  baseURL: "https://api.deepinfra.com/v1/openai",
  apiKey: import.meta.env.VITE_DEEPINFRA_API_KEY,
  name: "deepinfra",
});

type OnStartFunction = (options: { messages: UIMessage[] }) => void;

export class FlexibleChatTransport implements ChatTransport<UIMessage> {
  private readonly onStart?: OnStartFunction;

  constructor({
    onStart,
  }: {
    onStart?: OnStartFunction;
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
  ) => Promise<ReadableStream<UIMessageChunk>> = async ({ messages }) => {
    this.onStart?.({ messages });

    const result = streamText({
      model: openai("moonshotai/Kimi-K2-Instruct"),
      messages: convertToModelMessages(messages),
      tools: ClientToolsV5,
    });
    return result.toUIMessageStream();
  };

  reconnectToStream: (
    options: { chatId: string } & ChatRequestOptions,
  ) => Promise<ReadableStream<UIMessageChunk> | null> = async () => {
    return null;
  };
}
