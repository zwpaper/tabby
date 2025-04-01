import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { zValidator } from "@hono/zod-validator";
import { openrouter } from "@openrouter/ai-sdk-provider";
import * as tools from "@ragdoll/tools";
import {
  type LanguageModel,
  type LanguageModelV1,
  type Message,
  streamText,
} from "ai";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { authRequest } from "./auth";
import { getReadEnvironmentResult } from "./prompts/environment";
import { generateSystemPrompt } from "./prompts/system";
import { type Environment, ZodChatRequestType } from "./types";

export type ContextVariables = {
  model?: LanguageModel;
};

export const app = new Hono<{ Variables: ContextVariables }>();

app.get("/health", (c) => c.text("OK"));

const api = app.basePath("/api");

// Define available models
const availableModels = [
  { id: "google/gemini-2.5-pro-exp-03-25", contextWindow: 1_000_000 },
  { id: "anthropic/claude-3.7-sonnet", contextWindow: 200_000 },
  { id: "openai/gpt-4o-mini", contextWindow: 128_000 },
];

// Endpoint to list available models
const route = api
  .get("/models", (c) => {
    return c.json(availableModels);
  })
  .post(
    "/chat/stream",
    zValidator("json", ZodChatRequestType),
    authRequest,
    async (c) => {
      const {
        messages,
        environment,
        model: requestedModelId,
      } = await c.req.valid("json");
      c.header("X-Vercel-AI-Data-Stream", "v1");
      c.header("Content-Type", "text/plain; charset=utf-8");

      let selectedModel: LanguageModelV1;
      switch (requestedModelId) {
        case "anthropic/claude-3.7-sonnet":
          selectedModel = openrouter("claude-3.7-sonnet");
          break;
        case "openai/gpt-4o-mini":
          selectedModel = openai("gpt-4o-mini");
          break;
        // case "google/gemini-2.5-pro-exp-03-25": // Removed redundant case
        default:
          selectedModel = google("gemini-2.5-pro-exp-03-25");
          break;
      }

      injectReadEnvironmentToolCall(messages, selectedModel, environment);

      const result = streamText({
        model: c.get("model") || selectedModel,
        system: environment?.info && generateSystemPrompt(environment.info),
        messages,
        tools,
        onError: (error) => {
          console.error(error);
          console.error(JSON.stringify(messages));
        },
      });

      return stream(c, (stream) => stream.pipe(result.toDataStream()));
    },
  );

export type AppType = typeof route;

function injectReadEnvironmentToolCall(
  messages: Message[],
  model: LanguageModelV1,
  environment?: Environment,
) {
  const isOpenRouter = model.provider.includes("openrouter");
  const isOpenAI = model.provider.includes("openai");

  if (environment === undefined) return;
  // There's only user message.
  if (messages.length === 1 && messages[0].role === "user") {
    // Prepend an empty assistant message.
    messages.unshift({
      id: `environmentMessage-assistant-${Date.now()}`,
      role: "assistant",
      content: "",
    });
    messages.unshift({
      id: `environmentMessage-user-${Date.now()}`,
      role: "user",
      content: " ",
    });
  }
  const messageToInject = getMessageToInject(messages);
  if (!messageToInject) return;

  const parts = [...(messageToInject.parts || [])];

  // create toolCallId with timestamp
  const toolCallId = `environmentToolCall-${Date.now()}`;
  parts.push({
    type: "tool-invocation",
    toolInvocation: {
      toolName: "readEnvironment",
      state: "result",
      args: isOpenAI || isOpenRouter ? "null" : undefined,
      toolCallId,
      result: getReadEnvironmentResult(environment),
    },
  });

  messageToInject.parts = parts;
}

function getMessageToInject(messages: Message[]): Message | undefined {
  if (messages[messages.length - 1].role === "assistant") {
    // Last message is a function call result, inject it directly.
    return messages[messages.length - 1];
  }
  if (messages[messages.length - 2].role === "assistant") {
    // Last message is a user message, inject to the assistant message.
    return messages[messages.length - 2];
  }
}

export default {
  port: process.env.PORT || 4111,
  fetch: app.fetch,
  idleTimeout: 60,
};
