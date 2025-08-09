import type {
  ChatRequestOptions,
  ChatTransport,
  UIMessageChunk,
} from "@ai-v5-sdk/ai";
import { formattersNext, prompts } from "@ragdoll/common";
import type { Environment } from "@ragdoll/db";
import type { Message, RequestData } from "../types";
import { requestLLM } from "./llm";

export type OnStartCallback = (options: {
  messages: Message[];
  environment?: Environment;
}) => void;

export type PrepareRequestDataCallback = () =>
  | RequestData
  | Promise<RequestData>;

export class FlexibleChatTransport implements ChatTransport<Message> {
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
      messages: Message[];
      abortSignal: AbortSignal | undefined;
    } & ChatRequestOptions,
  ) => Promise<ReadableStream<UIMessageChunk>> = async ({
    chatId,
    messages,
    abortSignal,
  }) => {
    const { environment, llm, mcpToolSet } = await this.prepareRequestData();

    this.onStart?.({
      messages,
      environment,
    });

    const system = prompts.system(environment?.info?.customRules);
    return requestLLM(llm, {
      system,
      messages: prepareMessages(messages, environment),
      abortSignal,
      id: chatId,
      mcpToolSet,
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
