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
import { type Environment, ZodEnvironment } from "@ragdoll/db";
import { z } from "zod";
import { readEnv } from "./env";

const openai = createOpenAICompatible({
  baseURL: "https://api.deepinfra.com/v1/openai",
  apiKey: readEnv("DEEPINFRA_API_KEY"),
  name: "deepinfra",
});

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
    const metadata = RequestMetadata.parse(options.metadata);
    this.onStart?.({
      messages,
      todos: metadata?.environment.todos || [],
    });
    const result = streamText({
      model: openai(metadata?.model || "zai-org/GLM-4.5"),
      messages: prepareMessages(messages, metadata?.environment),
      tools: ClientToolsV5,
      system: prompts.system(metadata?.environment.info?.customRules),
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

const RequestMetadata = z
  .object({
    environment: ZodEnvironment,
    model: z.string().optional(),
  })
  .optional();

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
