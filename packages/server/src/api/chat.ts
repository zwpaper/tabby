import { zValidator } from "@hono/zod-validator";
import { isAutoInjectTool, isUserInputTool } from "@ragdoll/tools";
import { ClientTools } from "@ragdoll/tools";
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
import { stream } from "hono/streaming";
import { sql } from "kysely";
import moment from "moment";
import { requireAuth } from "../auth";
import { type DB, type UserEvent, db } from "../db";
import {
  checkModel,
  checkUserQuota,
  checkWhitelist,
} from "../lib/check-request";
import {
  fromUIMessages,
  toUIMessage,
  toUIMessages,
} from "../lib/message-utils";
import { MakeServerTools } from "../lib/tools";
import { getReadEnvironmentResult } from "../prompts/environment";
import { generateSystemPrompt } from "../prompts/system";
import { type Environment, ZodChatRequestType } from "../types";
import { createTask } from "./tasks";

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

    await checkUserQuota(user, c, requestedModelId);
    const selectedModel = checkModel(requestedModelId);

    checkWhitelist(user);

    const { id, conversation, event } = await getTask(user, req.id, req.event);
    const messages = appendClientMessage({
      messages: toUIMessages(conversation?.messages || []),
      message: toUIMessage(message),
    });

    await db
      .updateTable("task")
      .set({ status: "streaming" })
      .where("taskId", "=", id)
      .where("userId", "=", user.id)
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
        ...ClientTools,
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
            environment,
            status: getTaskStatus(messagesToSave, finishReason),
            conversation: {
              messages: fromUIMessages(messagesToSave),
            },
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where("taskId", "=", id)
          .where("userId", "=", user.id)
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
        if (req.id === undefined) {
          stream.writeData({ id });
        }
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
  event: DB["task"]["event"],
): Message[] {
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

  if (environment === undefined) return messages;
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
  if (!messageToInject) return messages;

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

async function getTask(
  user: User,
  chatId: string | undefined,
  event: UserEvent | undefined,
) {
  let taskId = chatId ? Number.parseInt(chatId) : undefined;
  if (taskId === undefined) {
    taskId = await createTask(user.id, undefined, event);
  }

  const data = await db
    .selectFrom("task")
    .select(["conversation", "event"])
    .where("taskId", "=", taskId)
    .where("userId", "=", user.id)
    .executeTakeFirstOrThrow();
  return {
    ...data,
    id: taskId,
  };
}

export default chat;

function getTaskStatus(messages: Message[], finishReason: FinishReason) {
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
