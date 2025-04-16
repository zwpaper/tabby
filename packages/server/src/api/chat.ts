import { zValidator } from "@hono/zod-validator";
import { Tools, isAutoInjectTool, isUserInputTool } from "@ragdoll/tools";
import {
  APICallError,
  type LanguageModel,
  type LanguageModelUsage,
  type LanguageModelV1,
  type Message,
  RetryError,
  appendClientMessage,
  appendResponseMessages,
  streamText,
} from "ai";
import type { User } from "better-auth";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { stream } from "hono/streaming";
import { sql } from "kysely";
import moment from "moment";
import { requireAuth } from "../auth";
import { db } from "../db";
import { readCurrentMonthQuota } from "../lib/billing";
import { AvailableModels, getModelById } from "../lib/constants";
import { decodeTaskId } from "../lib/task-id";
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
    const req = await c.req.valid("json");
    const {
      message,
      environment,
      model: requestedModelId = "google/gemini-2.5-pro",
    } = req;
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

    const selectedModel = getModelById(requestedModelId);
    if (!selectedModel) {
      throw new HTTPException(400, {
        message: `Invalid model '${requestedModelId}'`,
      });
    }

    const { id, messages: previousMessages } = await getTask(user, req.id);
    const messages = appendClientMessage({
      messages: previousMessages,
      message,
    });

    const result = streamText({
      toolCallStreaming: true,
      model: c.get("model") || selectedModel,
      system: environment?.info && generateSystemPrompt(environment.info),
      messages: preprocessMessages(messages, selectedModel, environment),
      tools: Tools,
      onError: async ({ error }) => {
        if (RetryError.isInstance(error)) {
          if (APICallError.isInstance(error.lastError)) {
            if (error.lastError.statusCode === 429) {
              console.error("Rate limit exceeded");
              return;
            }
          }
        }

        console.error("error", error);
        console.log((await result.request).body);
      },
      onFinish: async ({ usage, finishReason, response }) => {
        await db
          .updateTable("task")
          .set({
            environment,
            finishReason,
            messages: JSON.stringify(
              postProcessMessages(
                appendResponseMessages({
                  messages,
                  responseMessages: response.messages,
                }),
              ),
            ),
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where("id", "=", id as number)
          .executeTakeFirstOrThrow()
          .catch(console.error);

        if (!Number.isNaN(usage.totalTokens)) {
          await trackUsage(user, requestedModelId, usage);
        }
      },
    });

    result.consumeStream();

    return stream(c, (stream) => stream.pipe(result.toDataStream()));
  },
);

function removeAutoInject(messages: Message[]) {
  const ret = [];
  for (const x of messages) {
    // Remove environment message
    if (x.id.startsWith("environmentMessage-")) {
      continue;
    }

    const m = {
      ...x,
    };

    if (m.parts) {
      m.parts = m.parts.filter((x) => {
        if (
          x.type === "tool-invocation" &&
          isAutoInjectTool(x.toolInvocation.toolName)
        )
          return false;
        return true;
      });
    }

    ret.push(m);
  }
  return ret;
}

function postProcessMessages(messages: Message[]) {
  const ret = removeAutoInject(messages);
  for (const x of ret) {
    x.toolInvocations = undefined;
  }

  return ret;
}

function preprocessMessages(
  inputMessages: Message[],
  model: LanguageModelV1,
  environment?: Environment,
) {
  // Auto reject User input tools.
  const messages = inputMessages.map((message) => {
    if (message.role === "assistant" && message.parts) {
      for (let i = 0; i < message.parts.length; i++) {
        const part = message.parts[i];
        if (
          part.type === "tool-invocation" &&
          part.toolInvocation.state !== "result"
        ) {
          part.toolInvocation = {
            ...part.toolInvocation,
            state: "result",
            result: isUserInputTool(part.toolInvocation.toolName)
              ? { success: true }
              : {
                  error: "User cancelled the tool call.",
                },
          };
        }
      }
    }
    return message;
  });

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
  return messages;
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
  const now = moment.utc();
  const startDayOfMonth = now.startOf("month").toDate();

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

async function getTask(
  user: User,
  chatId: string,
): Promise<{
  id: number;
  messages: Message[];
}> {
  const id = decodeTaskId(chatId);
  const data = await db
    .selectFrom("task")
    .select(["messages"])
    .where("id", "=", id as number)
    .where("userId", "=", user.id)
    .executeTakeFirstOrThrow();
  const messages = data.messages as unknown as Message[];
  return {
    id,
    messages,
  };
}

export default chat;
