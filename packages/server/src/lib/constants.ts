// packages/server/src/lib/constants.ts

import { anthropic } from "@ai-sdk/anthropic";
import { type GoogleGenerativeAIProviderOptions, google } from "@ai-sdk/google";
import {
  type LanguageModelV1,
  type LanguageModelV1Middleware,
  wrapLanguageModel,
} from "ai";
import { createBatchCallMiddleware } from "./batch-call-middleware";
import {
  type NewTaskMiddlewareContext,
  createNewTaskMiddleware,
} from "./new-task-middleware";
import { createToolMiddleware } from "./tool-call-middleware";

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
    priceId: "price_1Rfat9DZw4FSeDxlqF0jcbGH",
    metered: true,
    limits: {
      basic: 5_000,
      premium: 500,
    },
  },
];

export interface MiddlewareContext {
  newTask?: NewTaskMiddlewareContext;
}

export function getModel(
  modelId: AvailableModelId,
  middlewareContext: MiddlewareContext = {},
  enableGeminiCustomToolCalls = true,
): LanguageModelV1 {
  const model = getModelById(modelId);

  // Create middlewares
  const middleware: LanguageModelV1Middleware[] = [];

  middleware.push(createBatchCallMiddleware());

  if (middlewareContext.newTask) {
    middleware.push(createNewTaskMiddleware(middlewareContext.newTask));
  }

  if (enableGeminiCustomToolCalls && modelId.includes("google/gemini-2.5")) {
    middleware.push(createToolMiddleware());
  }
  return wrapLanguageModel({
    model,
    middleware,
  });
}

function getModelById(modelId: AvailableModelId): LanguageModelV1 {
  switch (modelId) {
    case "anthropic/claude-4-sonnet":
      return anthropic("claude-4-sonnet-20250514");
    case "google/gemini-2.5-pro":
      return google("gemini-2.5-pro");
    case "google/gemini-2.5-flash":
      return google("gemini-2.5-flash");
  }
}

export function getProviderOptionsById(modelId: string) {
  switch (modelId) {
    case "google/gemini-2.5-pro":
      return {
        google: {
          thinkingConfig: {
            includeThoughts: true,
          },
        } satisfies GoogleGenerativeAIProviderOptions,
      };
    case "google/gemini-2.5-flash":
      return {
        google: {
          thinkingConfig: {
            includeThoughts: true,
          },
        } satisfies GoogleGenerativeAIProviderOptions,
      };
    default:
      return undefined;
  }
}
