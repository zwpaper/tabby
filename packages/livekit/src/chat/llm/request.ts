import {
  convertToModelMessages,
  streamText,
  wrapLanguageModel,
} from "@ai-v5-sdk/ai";
import { ClientToolsV5 } from "@getpochi/tools";

import type { LanguageModelV2 } from "@ai-v5-sdk/provider";
import { makeRepairToolCall } from "./repair-tool-call";
import type { LLMRequest } from "./types";
import { parseMcpToolSet } from "./utils";

export async function request(model: LanguageModelV2, payload: LLMRequest) {
  const mcpTools = payload.mcpToolSet && parseMcpToolSet(payload.mcpToolSet);
  const tools = {
    ...ClientToolsV5,
    ...(mcpTools || {}),
  };
  const toolNames = Object.keys(tools) as Array<keyof typeof tools>;

  const result = streamText({
    model: wrapLanguageModel({
      model,
      middleware: payload.middlewares || [],
    }),
    abortSignal: payload.abortSignal,
    system: payload.system,
    messages: convertToModelMessages(payload.messages),
    tools,
    activeTools: payload.allowNewTask
      ? undefined
      : toolNames.filter((tool) => tool !== "newTask"),
    maxRetries: 0,
    // error log is handled in live chat kit.
    onError: () => {},
    experimental_repairToolCall: makeRepairToolCall(model),
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
