import { type AnthropicProviderOptions, anthropic } from "@ai-sdk/anthropic";
import { deepinfra } from "@ai-sdk/deepinfra";
import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { createVertex } from "@ai-sdk/google-vertex";
import { groq } from "@ai-sdk/groq";
import type { LanguageModelV1, streamText } from "ai";
import type { ChatRequest } from "../types";

// Define available models
export type AvailableModelId =
  | "google/gemini-2.5-pro"
  | "google/gemini-2.5-flash"
  | "anthropic/claude-4-sonnet"
  | "moonshotai/kimi-k2"
  | "pochi/pro-1"
  | "qwen/qwen3-coder";

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
    id: "pochi/pro-1",
    contextWindow: 1_048_576,
    costType: "basic",
  },
  {
    id: "anthropic/claude-4-sonnet",
    contextWindow: 200_000,
    costType: "premium",
  },
  {
    id: "moonshotai/kimi-k2",
    contextWindow: 131_072,
    costType: "basic",
  },
  {
    id: "qwen/qwen3-coder",
    contextWindow: 262_144,
    costType: "basic",
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
    }
  | {
      type: "groq";
      modelId: "moonshotai/kimi-k2-instruct";
      inputTokens: number;
      outputTokens: number;
    }
  | {
      type: "deepinfra";
      modelId: "qwen/qwen3-coder";
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
  groq: {
    "moonshotai/kimi-k2-instruct": {
      input: 10,
      output: 30,
    },
  },
  deepinfra: {
    "qwen/qwen3-coder": {
      input: 4,
      output: 16,
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

// https://deepinfra.com/Qwen/Qwen3-Coder-480B-A35B-Instruct
function computeCreditCostForDeepInfra(
  input: Extract<CreditCostInput, { type: "deepinfra" }>,
): number {
  const { modelId, inputTokens, outputTokens } = input;
  const price = PriceByModel.deepinfra[modelId];
  return inputTokens * price.input + outputTokens * price.output;
}

// https://console.groq.com/docs/model/moonshotai/kimi-k2-instruct
function computeCreditCostForGroq(
  input: Extract<CreditCostInput, { type: "groq" }>,
): number {
  const { modelId, inputTokens, outputTokens } = input;
  const price = PriceByModel.groq[modelId];
  return inputTokens * price.input + outputTokens * price.output;
}

// Returns the cost credit for a usage.
// 1 USD = 10M credits.
export function computeCreditCost(input: CreditCostInput): number {
  switch (input.type) {
    case "google":
      return computeCreditCostForGoogle(input);
    case "anthropic":
      return computeCreditCostForAnthropic(input);
    case "groq":
      return computeCreditCostForGroq(input);
    case "deepinfra":
      return computeCreditCostForDeepInfra(input);
    default:
      throw new Error("Unknown model type");
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
  {
    name: "Organization",
    priceId: "price_1RkyHPDZw4FSeDxljz9bLTZz",
    metered: true,
    limits: {
      basic: 5_000,
      premium: 500,
    },
  },
];

export function getModelById(
  modelId: AvailableModelId,
  modelEndpointId?: string,
): LanguageModelV1 {
  switch (modelId) {
    case "anthropic/claude-4-sonnet":
      return anthropic("claude-4-sonnet-20250514");
    case "google/gemini-2.5-pro":
      return vertex("gemini-2.5-pro");
    case "google/gemini-2.5-flash":
      return geminiFlash;
    case "moonshotai/kimi-k2":
      return groq("moonshotai/kimi-k2-instruct");
    case "pochi/pro-1":
      return vertexFineTuning(modelEndpointId || "2224986023618674688");
    case "qwen/qwen3-coder":
      return deepinfra("Qwen/Qwen3-Coder-480B-A35B-Instruct");
    default:
      throw new Error("Unknown model id");
  }
}

export function getModelOptions(
  modelId: AvailableModelId | NonNullable<ChatRequest["openAIModelOverride"]>,
): Partial<Parameters<typeof streamText>["0"]> {
  if (typeof modelId !== "string") {
    return {
      maxTokens: modelId.maxOutputTokens,
    };
  }

  switch (modelId) {
    case "pochi/pro-1":
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
    case "moonshotai/kimi-k2":
      return {
        maxTokens: 1024 * 14, // 14k tokens
      };
    case "qwen/qwen3-coder":
      return {
        maxTokens: 1024 * 32,
      };
  }
}

const vertex = createVertex({
  baseURL: `https://aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_VERTEX_PROJECT}/locations/${process.env.GOOGLE_VERTEX_LOCATION}/publishers/google`,
  googleAuthOptions: {
    credentials: JSON.parse(process.env.GOOGLE_VERTEX_CREDENTIALS || ""),
  },
});

function patchedFetchForFinetune(
  requestInfo: Request | URL | string,
  requestInit?: RequestInit,
): Promise<Response> {
  function patchString(str: string) {
    return str.replace("/publishers/google/models", "/endpoints");
  }

  if (requestInfo instanceof URL) {
    const patchedUrl = new URL(requestInfo);
    patchedUrl.pathname = patchString(patchedUrl.pathname);
    return fetch(patchedUrl, requestInit);
  }
  if (requestInfo instanceof Request) {
    const patchedUrl = patchString(requestInfo.url);
    const patchedRequest = new Request(patchedUrl, requestInfo);
    return fetch(patchedRequest, requestInit);
  }
  if (typeof requestInfo === "string") {
    const patchedUrl = patchString(requestInfo);
    return fetch(patchedUrl, requestInit);
  }
  // Should never happen
  throw new Error(`Unexpected requestInfo type: ${typeof requestInfo}`);
}

const vertexFineTuning = createVertex({
  location: "us-central1",
  baseURL: `https://aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_VERTEX_PROJECT}/locations/us-central1/publishers/google`,
  googleAuthOptions: {
    credentials: JSON.parse(process.env.GOOGLE_VERTEX_CREDENTIALS || ""),
  },
  fetch: patchedFetchForFinetune as unknown as typeof globalThis.fetch,
});

export const geminiFlash = vertex("gemini-2.5-flash");
