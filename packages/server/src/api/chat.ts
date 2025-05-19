import { zValidator } from "@hono/zod-validator";
import { Laminar, getTracer } from "@lmnr-ai/lmnr";
import { isUserInputTool, selectServerTools } from "@ragdoll/tools";
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
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  streamText,
} from "ai";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import moment from "moment";
import { type User, requireAuth } from "../auth";
import { type DB, db } from "../db";
import {
  checkModel,
  checkUserQuota,
  checkWaitlist,
} from "../lib/check-request";
import { toUIMessage, toUIMessages } from "../lib/message-utils"; // Removed fromUIMessages
import { resolveServerTools } from "../lib/tools";
import {
  injectReadEnvironment,
  stripReadEnvironment,
} from "../prompts/environment";
import { generateSystemPrompt } from "../prompts/system";
import { taskRepository } from "../repositories/task-repository";
import { type Environment, ZodChatRequestType } from "../types";

export type ContextVariables = {
  model?: LanguageModel;
};

const chat = new Hono<{ Variables: ContextVariables }>().post(
  "/stream",
  zValidator("json", ZodChatRequestType),
  requireAuth(),
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

    checkWaitlist(user);

    const { id, conversation, event } = await taskRepository.getOrCreate(
      user,
      req.id,
      req.event,
      environment,
    );
    const messages = appendClientMessage({
      messages: toUIMessages(conversation?.messages || []),
      message: toUIMessage(message),
    });

    await taskRepository.updateStatus(id, user.id, "streaming");

    // Prepare the tools to be used in the streamText call
    const enabledServerTools = selectServerTools(
      ["webFetch"].concat(req.tools || []),
    );

    // Update the environment.
    if (environment) {
      // Ensure environment is defined before updating
      await taskRepository
        .updateEnvironment(id, user.id, environment)
        .catch(console.error);
    }

    const processedMessages = await preprocessMessages(
      messages,
      selectedModel,
      environment,
      user,
      event,
    );

    const result = Laminar.withSession(`${user.id}-${id}`, () =>
      streamText({
        toolCallStreaming: true,
        model: c.get("model") || selectedModel,
        system: environment?.info && generateSystemPrompt(environment.info),
        messages: processedMessages,
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
          const taskStatus = getTaskStatus(messagesToSave, finishReason);

          await taskRepository
            .updateMessages(id, user.id, taskStatus, messagesToSave)
            .catch(console.error);

          if (!Number.isNaN(usage.totalTokens)) {
            await trackUsage(user, requestedModelId, usage);
          }
        },
        experimental_telemetry: {
          isEnabled: true,
          tracer: getTracer(),
          metadata: {
            "user-id": user.id,
            "user-email": user.email,
            "task-id": id,
          },
        },
      }),
    );

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

function postProcessMessages(messages: Message[]) {
  const ret = stripReadEnvironment(messages);
  for (const x of ret) {
    x.toolInvocations = undefined;
  }

  return ret;
}

async function preprocessMessages(
  inputMessages: Message[],
  model: LanguageModelV1,
  environment: Environment | undefined,
  user: User,
  event: DB["task"]["event"],
): Promise<Message[]> {
  let messages = resolvePendingTools(inputMessages);
  messages = injectReadEnvironment(messages, model, environment, event);
  messages = await resolveServerTools(messages, user);
  return messages;
}

function resolvePendingTools(inputMessages: Message[]) {
  return inputMessages.map((message) => {
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
