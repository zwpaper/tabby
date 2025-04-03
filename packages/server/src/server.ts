import { Hono } from "hono";
import { logger } from "hono/logger";
import chat from "./api/chat";
import { auth } from "./auth";

export const app = new Hono();
app.use(logger());

app.get("/health", (c) => c.text("OK"));

// Auth routes
app.on(["GET", "POST"], "/api/auth/**", (c) => auth.handler(c.req.raw));

const api = app.basePath("/api");

// Define available models
const AvailableModels = [
  { id: "google/gemini-2.5-pro-exp-03-25", contextWindow: 1_000_000 },
  { id: "anthropic/claude-3.7-sonnet", contextWindow: 200_000 },
  { id: "openai/gpt-4o-mini", contextWindow: 128_000 },
];

// Endpoint to list available models
const route = api
  .get("/models", (c) => {
    return c.json(AvailableModels);
  })
  .route("/chat", chat);

export type AppType = typeof route;

export default {
  port: process.env.PORT || 4111,
  fetch: app.fetch,
  idleTimeout: 60,
};
