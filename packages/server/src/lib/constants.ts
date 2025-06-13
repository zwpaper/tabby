// packages/server/src/lib/constants.ts

import { anthropic } from "@ai-sdk/anthropic";
import { type GoogleGenerativeAIProviderOptions, google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { type LanguageModelV1, wrapLanguageModel } from "ai";
import { createBatchCallMiddleware } from "./batch-call-middleware";
import { createNewTaskMiddleware } from "./new-task-middleware";

// Define available models
export const AvailableModels: {
  id: string;
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
  {
    id: "openai/o3",
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

export function getModelById(
  modelId: string,
  userId: string,
): LanguageModelV1 | null {
  const model = getModelByIdImpl(modelId);
  if (!model) {
    return model;
  }

  return wrapLanguageModel({
    model,
    middleware: [createBatchCallMiddleware(), createNewTaskMiddleware(userId)],
  });
}

function getModelByIdImpl(modelId: string): LanguageModelV1 | null {
  switch (modelId) {
    case "anthropic/claude-4-sonnet":
      return anthropic("claude-4-sonnet-20250514");
    case "google/gemini-2.5-pro":
      return google("gemini-2.5-pro-preview-06-05");
    case "google/gemini-2.5-flash":
      return google("gemini-2.5-flash-preview-04-17");
    case "openai/o3":
      return openai("o3-2025-04-16", {
        reasoningEffort: "medium",
      });
    default:
      return null;
  }
}

export function getProviderOptionsById(modelId: string) {
  switch (modelId) {
    case "google/gemini-2.5-pro":
      return {
        google: {
          thinkingConfig: {
            includeThoughts: true,
            // 8k thinking budget
            thinkingBudget: 1024 * 8,
          },
        } satisfies GoogleGenerativeAIProviderOptions,
      };
    case "google/gemini-2.5-flash":
      return {
        google: {
          thinkingConfig: {
            includeThoughts: true,
            // 16k thinking budget
            thinkingBudget: 1024 * 16,
          },
        } satisfies GoogleGenerativeAIProviderOptions,
      };
    default:
      return undefined;
  }
}
