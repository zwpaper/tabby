import {
  type ChatRequestOptions,
  type ChatTransport,
  DefaultChatTransport,
  type Tool,
  type UIMessageChunk,
  convertToModelMessages,
  jsonSchema,
  streamText,
  tool,
} from "@ai-v5-sdk/ai";
import { createOpenAICompatible } from "@ai-v5-sdk/openai-compatible";
import { ClientToolsV5, type McpTool } from "@getpochi/tools";
import { formatters, prompts } from "@ragdoll/common";
import type { Environment } from "@ragdoll/db";
import type { Message, RequestData } from "../types";
import { fromV4UIMessage, toV4UIMessage } from "../v4-adapter";

export type OnStartCallback = (options: {
  messages: Message[];
  environment?: Environment;
}) => void;

export type PrepareRequestDataCallback = ({
  messages,
}: {
  messages: Message[];
}) => RequestData | Promise<RequestData>;

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
    const { environment, llm, mcpToolSet } = await this.prepareRequestData({
      messages,
    });

    this.onStart?.({
      messages,
      environment,
    });

    const system = prompts.system(environment?.info?.customRules);
    const payload = {
      system,
      messages: await prepareMessages(messages as Message[], environment),
      abortSignal,
      id: chatId,
      mcpToolSet,
    };

    if (llm.type === "openai") {
      return requestOpenAI(llm, payload);
    }

    if (llm.type === "pochi") {
      return requestPochi(llm, payload);
    }

    throw new Error(`Unsupported LLM type: ${JSON.stringify(llm)}`);
  };

  reconnectToStream: (
    options: { chatId: string } & ChatRequestOptions,
  ) => Promise<ReadableStream<UIMessageChunk> | null> = async () => {
    return null;
  };
}

type RequestPayload = {
  id: string;
  system: string;
  abortSignal?: AbortSignal;
  messages: Message[];
  mcpToolSet?: Record<string, McpTool>;
};

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

  return Promise.all(llmMessages.map(fromV4UIMessage));
}

async function requestOpenAI(
  llm: Extract<RequestData["llm"], { type: "openai" }>,
  payload: RequestPayload,
) {
  const openai = createOpenAICompatible({
    name: "BYOK",
    baseURL: llm.baseURL,
    apiKey: llm.apiKey,
  });

  const model = openai(llm.modelId);
  const mcpTools = payload.mcpToolSet && parseMcpToolSet(payload.mcpToolSet);
  const result = streamText({
    model,
    abortSignal: payload.abortSignal,
    system: payload.system,
    messages: convertToModelMessages(payload.messages),
    tools: {
      ...ClientToolsV5,
      ...(mcpTools || {}),
    },
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
}

const defaultTransport = new DefaultChatTransport<Message>();

async function requestPochi(
  llm: Extract<RequestData["llm"], { type: "pochi" }>,
  payload: RequestPayload,
) {
  const body = JSON.stringify({
    id: payload.id,
    system: payload.system,
    messages: payload.messages,
    model: llm.modelId,
    mcpToolSet: payload.mcpToolSet,
  });
  const response = await fetch("https://app.getpochi.com/api/chatNext/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llm.token}`,
    },
    signal: payload.abortSignal,
    body,
  });

  if (!response.ok) {
    throw new Error(
      (await response.text()) ?? "Failed to fetch the chat response.",
    );
  }

  if (!response.body) {
    throw new Error("The response body is empty.");
  }

  // @ts-expect-error reuse default transport.
  return defaultTransport.processResponseStream(response.body);
}

function parseMcpTool(mcpTool: McpTool): Tool {
  return tool({
    description: mcpTool.description,
    inputSchema: jsonSchema(mcpTool.parameters.jsonSchema),
  });
}

function parseMcpToolSet(
  mcpToolSet: Record<string, McpTool> | undefined,
): Record<string, Tool> | undefined {
  return mcpToolSet
    ? Object.fromEntries(
        Object.entries(mcpToolSet).map(([name, tool]) => [
          name,
          parseMcpTool(tool),
        ]),
      )
    : undefined;
}
