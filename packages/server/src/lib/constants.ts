// packages/server/src/lib/constants.ts

import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";

// Define available models
export const AvailableModels: {
  id: string;
  contextWindow: number;
  costType: "basic" | "premium";
}[] = [
  { id: "openai/gpt-4o-mini", contextWindow: 128_000, costType: "basic" },
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
    id: "anthropic/claude-3.7-sonnet",
    contextWindow: 200_000,
    costType: "premium",
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

export function getModelById(modelId: string): LanguageModelV1 | null {
  switch (modelId) {
    case "anthropic/claude-3.7-sonnet":
      return anthropic("claude-3-7-sonnet-20250219");
    case "anthropic/claude-4-sonnet":
      return anthropic("claude-4-sonnet-20250514");
    case "openai/gpt-4o-mini":
      return openai("gpt-4o-mini");
    case "google/gemini-2.5-pro":
      return google("gemini-2.5-pro-preview-05-06");
    case "google/gemini-2.5-flash":
      return google("gemini-2.5-flash-preview-04-17");
    default:
      return null;
  }
}
