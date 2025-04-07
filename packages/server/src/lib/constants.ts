// packages/server/src/lib/constants.ts

import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";

// Define available models
export const AvailableModels: {
  id: string;
  contextWindow: number;
  costType: "basic" | "premium";
}[] = [
  {
    id: "google/gemini-2.5-pro-exp-03-25",
    contextWindow: 1_000_000,
    costType: "premium",
  },
  { id: "openai/gpt-4o", contextWindow: 128_000, costType: "premium" },
  { id: "openai/gpt-4o-mini", contextWindow: 128_000, costType: "basic" },
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

export function getModelById(modelId: string): LanguageModelV1 | null {
  switch (modelId) {
    // case "anthropic/claude-3.7-sonnet":
    //   return openrouter("anthropic/claude-3.7-sonnet");
    case "openai/gpt-4o-mini":
      return openai("gpt-4o-mini");
    case "openai/gpt-4o":
      return openai("gpt-4o");
    case "google/gemini-2.5-pro-exp-03-25":
      return google("gemini-2.5-pro-exp-03-25");
    default:
      return null;
  }
}
