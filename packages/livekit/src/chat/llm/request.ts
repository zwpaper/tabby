import {
  convertToModelMessages,
  streamText,
  wrapLanguageModel,
} from "@ai-v5-sdk/ai";
import { ClientToolsV5 } from "@getpochi/tools";

import type { LanguageModelV2 } from "@ai-v5-sdk/provider";
import type { LLMRequest } from "./types";
import { parseMcpToolSet } from "./utils";

export async function request(model: LanguageModelV2, payload: LLMRequest) {
  const mcpTools = payload.mcpToolSet && parseMcpToolSet(payload.mcpToolSet);
  const result = streamText({
    model: wrapLanguageModel({
      model,
      middleware: payload.middlewares || [],
    }),
    abortSignal: payload.abortSignal,
    system: payload.system,
    messages: convertToModelMessages(payload.messages),
    tools: {
      ...ClientToolsV5,
      ...(mcpTools || {}),
    },
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
