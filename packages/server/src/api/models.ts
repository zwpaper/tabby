import { Hono } from "hono";

// Define available models
const AvailableModels = [
  { id: "google/gemini-2.5-pro-exp-03-25", contextWindow: 1_000_000, premium: true},
  { id: "openai/gpt-4o-mini", contextWindow: 128_000, premium: false },
];

const models = new Hono().get("/", (c) => {
  return c.json(AvailableModels);
});

export default models;
