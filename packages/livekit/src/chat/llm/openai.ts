import {
  type Tool,
  convertToModelMessages,
  jsonSchema,
  streamText,
  tool,
} from "@ai-v5-sdk/ai";
import { createOpenAICompatible } from "@ai-v5-sdk/openai-compatible";
import { ClientToolsV5 } from "@getpochi/tools";
import type { McpTool } from "@getpochi/tools";

import type { RequestData } from "../../types";
import type { LLMRequest } from "./types";

export async function requestOpenAI(
  llm: Extract<RequestData["llm"], { type: "openai" }>,
  payload: LLMRequest,
) {
  const openai = createOpenAICompatible({
    name: "OpenAI",
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
    // error log is handled in live chat kit.
    onError: () => {},
  });
  return result.toUIMessageStream({
    messageMetadata: ({ part }) => {
      if (part.type === "finish") {
        return {
          kind: "assistant",
          totalTokens: part.totalUsage.totalTokens,
          finishReason: part.finishReason,
        };
      }
    },
  });
}

function parseMcpTool(mcpTool: McpTool): Tool {
  return tool({
    description: mcpTool.description,
    inputSchema: jsonSchema(mcpTool.inputSchema.jsonSchema),
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
