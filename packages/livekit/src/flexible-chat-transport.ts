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
import { prompts } from "@ragdoll/common";
import { ZodEnvironment } from "@ragdoll/db";
import { z } from "zod";
import { readEnv } from "./env";

const openai = createOpenAICompatible({
  baseURL: "https://api.deepinfra.com/v1/openai",
  apiKey: readEnv("DEEPINFRA_API_KEY"),
  name: "deepinfra",
});

export type OnStartCallback = (options: { messages: UIMessage[] }) => void;

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
    const metadata = RequestMetadata.parse(options.metadata);
    this.onStart?.({ messages });
    const result = streamText({
      model: openai(metadata?.model || "zai-org/GLM-4.5"),
      messages: convertToModelMessages(messages),
      tools: ClientToolsV5,
      // FIXME: add customRules, inject environment details.
      system: prompts.system(undefined),
    });
    return result.toUIMessageStream();
  };

  reconnectToStream: (
    options: { chatId: string } & ChatRequestOptions,
  ) => Promise<ReadableStream<UIMessageChunk> | null> = async () => {
    return null;
  };
}

const RequestMetadata = z
  .object({
    environment: ZodEnvironment,
    model: z.string().optional(),
  })
  .optional();
