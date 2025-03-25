import { openai } from "@ai-sdk/openai";
import * as tools from "@ragdoll/tools";
import { type Message, streamText } from "ai";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { generateSystemPrompt } from "./prompts";

const api = new Hono().basePath("/api");

interface ChatRequest {
  messages: Message[];
}

api.post("/chat/stream", async (c) => {
  const { messages } = (await c.req.json()) as ChatRequest;
  c.header("X-Vercel-AI-Data-Stream", "v1");
  c.header("Content-Type", "text/plain; charset=utf-8");

  const result = await streamText({
    model: openai("gpt-4o-mini"),
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
