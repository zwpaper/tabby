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
    priceId: "price_1RApQzDZw4FSeDxlCtidLAf5",
    annualDiscountPriceId: "price_1RApRUDZw4FSeDxlDrULHG4Z",
    limits: {
      basic: 100_000,
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
  enableGeminiCustomToolCalls = false,
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
      return google("gemini-2.5-pro-preview-06-05");
    case "google/gemini-2.5-flash":
      return google("gemini-2.5-flash-preview-04-17");
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
