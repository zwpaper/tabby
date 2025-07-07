// packages/server/src/lib/constants.ts

import { type AnthropicProviderOptions, anthropic } from "@ai-sdk/anthropic";
import { type GoogleGenerativeAIProviderOptions, google } from "@ai-sdk/google";
import type { LanguageModelV1, streamText } from "ai";

// Define available models
export type AvailableModelId =
  | "google/gemini-2.5-pro"
  | "google/gemini-2.5-flash"
  | "anthropic/claude-4-sonnet";

export const AvailableModels: {
  id: AvailableModelId;
  contextWindow: number;
  costType: "basic" | "premium";
}[] = [
  {
    id: "google/gemini-2.5-pro",
    contextWindow: 1_048_576,
    costType: "premium",
  },
  {
    id: "google/gemini-2.5-flash",
    contextWindow: 1_048_576,
    costType: "basic",
  },
  {
    id: "anthropic/claude-4-sonnet",
    contextWindow: 200_000,
    costType: "premium",
  },
];

// Returns the cost credit for a usage.
// 1 USD = 10M credits.
export function computeCreditCost(
  modelId: string,
  usage: {
    promptTokens: number;
    completionTokens: number;
  },
) {
  const { promptTokens, completionTokens } = usage;
  switch (modelId) {
    case "google/gemini-2.5-pro":
      // Ref: https://ai.google.dev/gemini-api/docs/pricing
      if (promptTokens <= 200_000) {
        return promptTokens * 12 + completionTokens * 100;
      }
      return promptTokens * 25 + completionTokens * 150;
    case "google/gemini-2.5-flash":
      // Ref: https://ai.google.dev/gemini-api/docs/pricing
      return promptTokens * 3 + completionTokens * 25;
    case "anthropic/claude-4-sonnet":
      // https://www.anthropic.com/pricing#api
      return promptTokens * 30 + completionTokens * 150;
    default:
      throw new Error(`Unknown model ID: ${modelId}`);
  }
}

export const StripePlans = [
  {
    name: "Community",
    limits: {
      basic: 10,
      premium: 5,
    },
  },
  {
    name: "Pro",
    priceId: "price_1Rfx2QDZw4FSeDxl2aSzsoB0",
    metered: true,
    limits: {
      basic: 5_000,
      premium: 500,
    },
  },
];

export function getModelById(modelId: AvailableModelId): LanguageModelV1 {
  switch (modelId) {
    case "anthropic/claude-4-sonnet":
      return anthropic("claude-4-sonnet-20250514");
    case "google/gemini-2.5-pro":
      return google("gemini-2.5-pro");
    case "google/gemini-2.5-flash":
      return google("gemini-2.5-flash");
  }
}

export function getModelOptions(
  modelId: AvailableModelId,
): Partial<Parameters<typeof streamText>["0"]> {
  switch (modelId) {
    case "google/gemini-2.5-flash":
    case "google/gemini-2.5-pro":
      return {
        maxTokens: 1024 * 64, // 64k tokens
        providerOptions: {
          google: {
            thinkingConfig: {
              includeThoughts: true,
            },
          } satisfies GoogleGenerativeAIProviderOptions,
        },
      };
    case "anthropic/claude-4-sonnet":
      return {
        maxTokens: 1024 * 58, // 55k tokens
        providerOptions: {
          anthropic: {
            thinking: {
              type: "enabled",
              budgetTokens: 1024,
            },
          } satisfies AnthropicProviderOptions,
        },
      };
    default:
      return {};
  }
}
