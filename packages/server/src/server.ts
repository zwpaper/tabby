import { createOpenAI } from "@ai-sdk/openai";
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

  const openai = createOpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  });

  const result = await streamText({
    model: c.get("model") || openai("gpt-4o-mini"),
    system: generateSystemPrompt(),
    messages,
    tools,
  });

  return stream(c, (stream) => stream.pipe(result.toDataStream()));
});

export default {
  fetch: api.fetch,
};
