import { wrapLanguageModel } from "@ai-v5-sdk/ai";
import { createOpenAICompatible } from "@ai-v5-sdk/openai-compatible";
import type { RequestData } from "../../types";

export function createOpenAIModel(
  llm: Extract<RequestData["llm"], { type: "openai" }>,
) {
  const openai = createOpenAICompatible({
    name: "OpenAI",
    baseURL: llm.baseURL,
    apiKey: llm.apiKey,
  });

  const model = wrapLanguageModel({
    model: openai(llm.modelId),
    middleware: {
      middlewareVersion: "v2",
      async transformParams({ params }) {
        params.maxOutputTokens = llm.maxOutputTokens;
        return params;
      },
    },
  });
  return {
    model,
    onFinish: undefined,
  };
}
