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
import { HTTPException } from "hono/http-exception";
import { stream } from "hono/streaming";
import { requireAuth } from "../auth";
import { db } from "../db";
import { readCurrentMonthQuota } from "../lib/billing";
import { AvailableModels } from "../lib/constants";
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
    const {
      messages,
      environment,
      model: requestedModelId = "google/gemini-2.5-pro-exp-03-25",
    } = await c.req.valid("json");
    c.header("X-Vercel-AI-Data-Stream", "v1");
    c.header("Content-Type", "text/plain; charset=utf-8");

    const user = c.get("user");

    const quotaCheck = async () => {
      const quota = await readCurrentMonthQuota(user, c.req);
      const modelCostType = AvailableModels.find(
        (model) => model.id === requestedModelId,
      )?.costType;
      if (!modelCostType) {
        throw new HTTPException(400, { message: "Invalid model" });
      }
      if (!user.email.endsWith("@tabbyml.com")) {
        if (quota.limits[modelCostType] - quota.usages[modelCostType] <= 0) {
          throw new HTTPException(400, {
            message: `You have reached the quota limit for ${modelCostType}. Please upgrade your plan or try again later.`,
          });
        }
      }
    };
    if (process.env.NODE_ENV !== "test") {
      await quotaCheck();
    }
    if (!user.email.endsWith("@tabbyml.com")) {
      throw new HTTPException(400, { message: "Internal user only" });
    }

    let selectedModel: LanguageModelV1;
    switch (requestedModelId) {
      // case "anthropic/claude-3.7-sonnet":
      //   selectedModel = openrouter("anthropic/claude-3.7-sonnet");
      //   break;
      case "openai/gpt-4o-mini":
        selectedModel = openai("gpt-4o-mini");
        break;
      case "google/gemini-2.5-pro-exp-03-25":
        selectedModel = google("gemini-2.5-pro-exp-03-25");
        break;
      default:
        throw new HTTPException(400, { message: "Invalid model" });
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
  // Track individual completion details
  await db
    .insertInto("chatCompletion")
    .values({
      modelId,
      userId: user.id,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
    })
    .execute();

  // Track monthly usage count
  const now = new Date();
  const startDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  await db
    .insertInto("monthlyUsage")
    .values({
      userId: user.id,
      modelId,
      startDayOfMonth,
      count: 1, // Start count at 1 for a new entry
    })
    .onConflict((oc) =>
      oc
        .columns(["userId", "startDayOfMonth", "modelId"])
        .doUpdateSet((eb) => ({
          count: eb("monthlyUsage.count", "+", 1),
        })),
    )
    .execute();
}

export default chat;
