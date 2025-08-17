import {
  type UIMessage,
  convertToModelMessages,
  streamText,
  wrapLanguageModel,
} from "ai";

import type { LanguageModelV2 } from "@ai-sdk/provider";
import { formatters } from "@getpochi/common";
import type { Message } from "../../types";
import { makeRepairToolCall } from "./repair-tool-call";
import type { LLMRequest, OnFinishCallback } from "./types";

export async function request(
  model: LanguageModelV2,
  payload: LLMRequest,
  onFinish?: OnFinishCallback,
) {
  const tools = payload.tools;

  const result = streamText({
    model: wrapLanguageModel({
      model,
      middleware: payload.middlewares || [],
    }),
    abortSignal: payload.abortSignal,
    system: payload.system,
    messages: convertToModelMessages(formatters.llm(payload.messages), {
      tools,
    }),
    tools,
    maxRetries: 0,
    // error log is handled in live chat kit.
    onError: () => {},
    experimental_repairToolCall: makeRepairToolCall(model),
  });
  return result.toUIMessageStream({
    originalMessages: payload.messages as UIMessage[],
    messageMetadata: ({ part }) => {
      if (part.type === "finish") {
        return {
          kind: "assistant",
          totalTokens: part.totalUsage.totalTokens,
          finishReason: part.finishReason,
        };
      }
    },
    onFinish: async ({ messages }) => {
      await onFinish?.({
        messages: messages as Message[],
      });
    },
  });
}
