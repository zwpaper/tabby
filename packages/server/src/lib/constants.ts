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
