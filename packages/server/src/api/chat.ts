import { zValidator } from "@hono/zod-validator";
import { Tools, isAutoInjectTool, isUserInputTool } from "@ragdoll/tools";
import {
  APICallError,
  type FinishReason,
  type LanguageModel,
  type LanguageModelUsage,
  type LanguageModelV1,
  type Message,
  NoSuchToolError,
  RetryError,
  type Tool,
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
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
import { toAiMessage, toAiMessages } from "../db/messages";
import type { TaskStatus } from "../db/schema";
import type { UserEvent } from "../db/user-event";
import { readCurrentMonthQuota } from "../lib/billing";
import {
  AvailableModels,
  WHITELIST_USERS,
  getModelById,
} from "../lib/constants";
import { decodeTaskId } from "../lib/task-id";
import { MakeServerTools } from "../lib/tools";
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
    if (
      !user.email.endsWith("@tabbyml.com") &&
      !WHITELIST_USERS.includes(user.email)
    ) {
      throw new HTTPException(400, { message: "Internal user only" });
    }

    const selectedModel = getModelById(requestedModelId);
    if (!selectedModel) {
      throw new HTTPException(400, {
        message: `Invalid model '${requestedModelId}'`,
      });
    }

    const {
      id,
      messages: previousMessages,
      event,
    } = await getTask(user, req.id);
    const messages = appendClientMessage({
      messages: toAiMessages(previousMessages),
      message: toAiMessage(message),
    });

    await db
      .updateTable("task")
      .set({ status: "streaming" })
      .where("id", "=", id)
      .execute();

    // Prepare the tools to be used in the streamText call
    const enabledServerTools: Record<string, Tool> = {};
    if (req.tools && req.tools.length > 0) {
      // Only include the requested server tools
      for (const toolName of req.tools) {
        if (toolName in MakeServerTools) {
          enabledServerTools[toolName] = MakeServerTools[toolName](user);
        }
      }
    }

    const result = streamText({
      toolCallStreaming: true,
      model: c.get("model") || selectedModel,
      system: environment?.info && generateSystemPrompt(environment.info),
      messages: preprocessMessages(messages, selectedModel, environment, event),
      tools: {
        ...Tools,
        ...enabledServerTools, // Add the enabled server tools
      },
      onFinish: async ({ usage, finishReason, response }) => {
        const messagesToSave = postProcessMessages(
          appendResponseMessages({
            messages,
            responseMessages: response.messages,
          }),
        );
        await db
          .updateTable("task")
          .set({
            environment: JSON.stringify(environment),
            status: getTaskStatus(messagesToSave, finishReason),
            messages: JSON.stringify(messagesToSave),
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

    const dataStream = createDataStream({
      execute: (stream) => {
        result.mergeIntoDataStream(stream);
      },
      onError(error) {
        if (RetryError.isInstance(error)) {
          if (APICallError.isInstance(error.lastError)) {
            if (error.lastError.statusCode === 429) {
              return "Too many requests. Please try again later.";
            }
          }
        }

        if (NoSuchToolError.isInstance(error)) {
          return `${error.toolName} is not a valid tool.`;
        }

        console.error("error", error);
        return "Something went wrong. Please try again.";
      },
    });

    return stream(c, (stream) => stream.pipe(dataStream));
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
  environment: Environment | undefined,
  event: UserEvent | null,
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
      result: getReadEnvironmentResult(environment, event),
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

async function getTask(user: User, chatId: string) {
  const id = decodeTaskId(chatId);
  const data = await db
    .selectFrom("task")
    .select(["messages", "event"])
    .where("id", "=", id as number)
    .where("userId", "=", user.id)
    .executeTakeFirstOrThrow();
  return {
    ...data,
    id,
  };
}

export default chat;

function getTaskStatus(
  messages: Message[],
  finishReason: FinishReason,
): TaskStatus {
  const lastMessage = messages[messages.length - 1];

  if (finishReason === "tool-calls") {
    if (hasAttemptCompletion(lastMessage)) {
      return "completed";
    }
    if (hasUserInputTool(lastMessage)) {
      return "pending-input";
    }
    return "pending-tool";
  }

  if (finishReason === "stop") {
    return "pending-input";
  }

  return "failed";
}

function hasAttemptCompletion(message: Message): boolean {
  if (message.role !== "assistant") {
    return false;
  }

  return !!message.parts?.some(
    (part) =>
      part.type === "tool-invocation" &&
      part.toolInvocation.toolName === "attemptCompletion",
  );
}

function hasUserInputTool(message: Message): boolean {
  if (message.role !== "assistant") {
    return false;
  }

  return !!message.parts?.some(
    (part) =>
      part.type === "tool-invocation" &&
      isUserInputTool(part.toolInvocation.toolName),
  );
}
