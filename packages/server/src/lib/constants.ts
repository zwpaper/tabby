import { type AnthropicProviderOptions, anthropic } from "@ai-sdk/anthropic";
import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { createVertex } from "@ai-sdk/google-vertex";
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

export type CreditCostInput =
  | {
      type: "anthropic";
      modelId: "claude-4-sonnet";
      cacheWriteInputTokens: number;
      cacheReadInputTokens: number;
      inputTokens: number;
      outputTokens: number;
    }
  | {
      type: "google";
      modelId: "gemini-2.5-pro" | "gemini-2.5-flash";
      cacheReadInputTokens: number;
      inputTokens: number;
      outputTokens: number;
    };

const PriceByModel = {
  anthropic: {
    "claude-4-sonnet": {
      cacheWrite: 37,
      cacheRead: 3,
      input: 30,
      output: 150,
    },
  },
  google: {
    "gemini/2.5-flash": {
      cacheRead: 1,
      input: 3,
      output: 25,
    },
    "gemini/2.5-pro": {
      base: {
        cacheRead: 3,
        input: 12,
        output: 100,
      },
      above200k: {
        cacheRead: 6,
        input: 25,
        output: 150,
      },
    },
  },
} as const;

// Ref: https://ai.google.dev/gemini-api/docs/pricing
function computeCreditCostForGoogle(
  input: Extract<CreditCostInput, { type: "google" }>,
): number {
  if (input.modelId === "gemini-2.5-pro") {
    const { inputTokens, outputTokens, cacheReadInputTokens } = input;
    const { base, above200k } = PriceByModel.google["gemini/2.5-pro"];
    const promptTokens = inputTokens + cacheReadInputTokens;
    if (promptTokens <= 200_000) {
      return (
        inputTokens * base.input +
        outputTokens * base.output +
        cacheReadInputTokens * base.cacheRead
      );
    }

    return (
      inputTokens * above200k.input +
      outputTokens * above200k.output +
      cacheReadInputTokens * above200k.cacheRead
    );
  }

  if (input.modelId === "gemini-2.5-flash") {
    const { inputTokens, outputTokens, cacheReadInputTokens } = input;
    const price = PriceByModel.google["gemini/2.5-flash"];
    return (
      inputTokens * price.input +
      outputTokens * price.output +
      cacheReadInputTokens * price.cacheRead
    );
  }

  throw new Error(`Unknown Google model ID: ${input.modelId}`);
}

// https://www.anthropic.com/pricing#api
function computeCreditCostForAnthropic(
  input: Extract<CreditCostInput, { type: "anthropic" }>,
): number {
  const {
    modelId,
    cacheWriteInputTokens,
    cacheReadInputTokens,
    inputTokens,
    outputTokens,
  } = input;
  const price = PriceByModel.anthropic[modelId];
  return (
    cacheWriteInputTokens * price.cacheWrite +
    cacheReadInputTokens * price.cacheRead +
    inputTokens * price.input +
    outputTokens * price.output
  );
}

// Returns the cost credit for a usage.
// 1 USD = 10M credits.
export function computeCreditCost(input: CreditCostInput): number {
  switch (input.type) {
    case "google":
      return computeCreditCostForGoogle(input);
    case "anthropic":
      return computeCreditCostForAnthropic(input);
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

const vertex = createVertex({
  baseURL: `https://aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_VERTEX_PROJECT}/locations/${process.env.GOOGLE_VERTEX_LOCATION}/publishers/google`,
  googleAuthOptions: {
    credentials: JSON.parse(process.env.GOOGLE_VERTEX_CREDENTIALS || ""),
  },
});

export function getModelById(modelId: AvailableModelId): LanguageModelV1 {
  switch (modelId) {
    case "anthropic/claude-4-sonnet":
      return anthropic("claude-4-sonnet-20250514");
    case "google/gemini-2.5-pro":
      return vertex("gemini-2.5-pro");
    case "google/gemini-2.5-flash":
      return geminiFlash;
  }
}

export function getModelOptions(
  modelId: AvailableModelId,
): Partial<Parameters<typeof streamText>["0"]> {
  switch (modelId) {
    case "google/gemini-2.5-flash":
    case "google/gemini-2.5-pro":
      return {
        maxTokens: 1024 * 32, // 32k tokens
        providerOptions: {
          google: {
            thinkingConfig: {
              includeThoughts: true,
              thinkingBudget: 4096,
            },
          } satisfies GoogleGenerativeAIProviderOptions,
        },
      };
    case "anthropic/claude-4-sonnet":
      return {
        maxTokens: 1024 * 32, // 32k tokens
        providerOptions: {
          anthropic: {
            thinking: {
              type: "enabled",
              budgetTokens: 4096,
            },
          } satisfies AnthropicProviderOptions,
        },
      };
    default:
      return {};
  }
}

export const geminiFlash = vertex("gemini-2.5-flash");
