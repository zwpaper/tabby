import type {
  ChatRequestOptions,
  ChatTransport,
  UIMessageChunk,
} from "@ai-v5-sdk/ai";
import { formattersNext, prompts } from "@ragdoll/common";
import type { Environment } from "@ragdoll/db";
import type { Message, RequestData } from "../types";
import { requestOpenAI } from "./llm-openai";
import { requestPochi } from "./llm-pochi";
import type { LLMRequest } from "./types";

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
    const req = {
      system,
      messages: prepareMessages(messages, environment),
      abortSignal,
      id: chatId,
      mcpToolSet,
    };

    return requestLLM(llm, req);
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
    // FIXME(meng): set user from git config
    undefined,
  );

  return formattersNext.llm(messages) as T[];
}

function requestLLM(llm: RequestData["llm"], req: LLMRequest) {
  if (llm.type === "openai") {
    return requestOpenAI(llm, req);
  }

  if (llm.type === "pochi") {
    return requestPochi(llm, req);
  }

  throw new Error(`Unsupported LLM type: ${JSON.stringify(llm)}`);
}
