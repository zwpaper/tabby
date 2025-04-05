import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { zValidator } from "@hono/zod-validator";
import * as tools from "@ragdoll/tools";
import {
  type LanguageModel,
  type LanguageModelUsage,
  type LanguageModelV1,
  type Message,
  streamText,
} from "ai";
import type { User } from "better-auth";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { requireAuth } from "../auth";
import { db } from "../db";
import { getReadEnvironmentResult } from "../prompts/environment";
import { generateSystemPrompt } from "../prompts/system";
import { type Environment, ZodChatRequestType } from "../types";

export type ContextVariables = {
  model?: LanguageModel;
};

const chat = new Hono<{ Variables: ContextVariables }>().post(
  "/stream",
  zValidator("json", ZodChatRequestType),
  requireAuth,
  async (c) => {
    const user = c.get("user");

    const {
      messages,
      environment,
      model: requestedModelId,
    } = await c.req.valid("json");
    c.header("X-Vercel-AI-Data-Stream", "v1");
    c.header("Content-Type", "text/plain; charset=utf-8");

    let selectedModel: LanguageModelV1;
    switch (requestedModelId) {
      case "openai/gpt-4o-mini":
        selectedModel = openai("gpt-4o-mini");
        break;
      // case "anthropic/claude-3.7-sonnet":
      //   selectedModel = openrouter("anthropic/claude-3.7-sonnet");
      //   break;
      case "google/gemini-2.5-pro-exp-03-25": // Removed redundant case
        selectedModel = google("gemini-2.5-pro-exp-03-25");
        break;
      default:
        return c.json({ error: "Invalid model" }, 400);
    }

    injectReadEnvironmentToolCall(messages, selectedModel, environment);

    const result = streamText({
      model: c.get("model") || selectedModel,
      system: environment?.info && generateSystemPrompt(environment.info),
      messages,
      tools,
      onError: async (error) => {
        console.error(error);
        console.log((await result.request).body);
      },
      onFinish: async ({ usage, finishReason }) => {
        if (finishReason === "unknown" || finishReason === "error") {
          return;
        }
        await trackUsage(user, requestedModelId, usage);
      },
    });

    return stream(c, (stream) => stream.pipe(result.toDataStream()));
  },
);

function injectReadEnvironmentToolCall(
  messages: Message[],
  model: LanguageModelV1,
  environment?: Environment,
) {
  const isGemini = model.provider.includes("gemini");

  if (environment === undefined) return;
  // There's only user message.
  if (messages.length === 1 && messages[0].role === "user") {
    // Prepend an empty assistant message.
    messages.unshift({
      id: `environmentMessage-assistant-${Date.now()}`,
      role: "assistant",
      content: " ",
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
      args: isGemini ? undefined : null,
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

async function trackUsage(
  user: User,
  modelId: string,
  usage: LanguageModelUsage,
) {
  await db
    .insertInto("chatCompletion")
    .values({
      modelId,
      userId: user.id,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
    })
    .execute();
}

export default chat;
