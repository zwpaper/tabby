import { google } from "@ai-sdk/google";
import * as tools from "@ragdoll/tools";
import { type LanguageModel, type Message, streamText } from "ai";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { generateSystemPrompt } from "./prompts";

export type ContextVariables = {
  model?: LanguageModel;
};

export const api = new Hono<{ Variables: ContextVariables }>().basePath("/api");

interface ChatRequest {
  messages: Message[];
}

api.post("/chat/stream", async (c) => {
  const { messages } = (await c.req.json()) as ChatRequest;
  c.header("X-Vercel-AI-Data-Stream", "v1");
  c.header("Content-Type", "text/plain; charset=utf-8");

  const result = streamText({
    model: c.get("model") || google("gemini-2.0-flash"),
    system: generateSystemPrompt(),
    messages,
    tools,
  });

  return stream(c, (stream) => stream.pipe(result.toDataStream()));
});

export default {
  port: 4111,
  fetch: api.fetch,
};
