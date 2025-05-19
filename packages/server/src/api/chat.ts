import { zValidator } from "@hono/zod-validator";
import { Laminar, getTracer } from "@lmnr-ai/lmnr";
import { isUserInputTool, selectServerTools } from "@ragdoll/tools";
import { ClientTools } from "@ragdoll/tools";
import {
  APICallError,
  type DataStreamWriter,
  type FinishReason,
  type LanguageModel,
  type LanguageModelV1,
  type Message,
  NoSuchToolError,
  RetryError,
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  generateId,
  streamText,
} from "ai";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { stream } from "hono/streaming";
import { createResumableStreamContext } from "resumable-stream";
import { z } from "zod";
import { type User, requireAuth } from "../auth";
import type { DB } from "../db";
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
import { after } from "../server";
import { taskService } from "../service/task";
import { usageService } from "../service/usage";
import { type Environment, ZodChatRequestType } from "../types";

const streamContext = createResumableStreamContext({
  waitUntil: after,
});

export type ContextVariables = {
  model?: LanguageModel;
};

const chat = new Hono<{ Variables: ContextVariables }>()
  .use(requireAuth())
  .post("/stream", zValidator("json", ZodChatRequestType), async (c) => {
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

    const { id, conversation, event } = await taskService.getOrCreate(
      user,
      req.id,
      req.event,
      environment,
    );

    const streamId = generateId();
    await taskService.appendStreamId(id, user.id, streamId);

    const messages = appendClientMessage({
      messages: toUIMessages(conversation?.messages || []),
      message: toUIMessage(message),
    });

    await saveMessages(id, user.id, "streaming", messages);

    // Prepare the tools to be used in the streamText call
    const enabledServerTools = selectServerTools(
      ["webFetch"].concat(req.tools || []),
    );

    // Update the environment.
    if (environment) {
      // Ensure environment is defined before updating
      await taskService
        .updateEnvironment(id, user.id, environment)
        .catch(console.error);
    }

    const dataStream = createDataStream({
      execute: async (stream) => {
        if (req.id === undefined) {
          stream.writeData({ type: "append-id", id });
        }

        const processedMessages = await preprocessMessages(
          messages,
          selectedModel,
          environment,
          user,
          event,
          stream,
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
              const messagesToSave = appendResponseMessages({
                messages,
                responseMessages: response.messages,
              });
              const taskStatus = getTaskStatus(messagesToSave, finishReason);
              await saveMessages(
                id,
                user.id,
                getTaskStatus(messages, finishReason),
                messagesToSave,
              );

              await taskService
                .updateMessages(id, user.id, taskStatus, messagesToSave)
                .catch(console.error);

              if (!Number.isNaN(usage.totalTokens)) {
                await usageService.trackUsage(user, requestedModelId, usage);
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

    const resumableStream = await streamContext.resumableStream(
      streamId,
      () => dataStream,
    );
    if (!resumableStream) {
      throw new HTTPException(500, {
        message: "Failed to create resumable stream.",
      });
    }

    return stream(c, (stream) => stream.pipe(resumableStream));
  })
  .get(
    "/stream",
    zValidator("query", z.object({ chatId: z.string() })),
    async (c) => {
      const query = c.req.valid("query");
      const user = c.get("user");
      const id = Number.parseInt(query.chatId);
      c.header("X-Vercel-AI-Data-Stream", "v1");
      c.header("Content-Type", "text/plain; charset=utf-8");

      const streamId = await taskService.fetchLatestStreamId(id, user.id);
      if (!streamId) {
        throw new HTTPException(404, { message: "Stream not found." });
      }

      const emptyDataStream = createDataStream({
        execute: () => {},
      });

      const resumableStream = await streamContext.resumableStream(
        streamId,
        () => emptyDataStream,
      );

      if (resumableStream) {
        return stream(c, (stream) => stream.pipe(resumableStream));
      }

      const task = await taskService.get(id, user.id);
      const mostRecentMessage = task?.conversation?.messages?.at(-1);
      if (!mostRecentMessage || mostRecentMessage.role !== "assistant") {
        return stream(c, (stream) => stream.pipe(emptyDataStream));
      }

      const streamWithMessage = createDataStream({
        execute: (buffer) => {
          buffer.writeData({
            type: "append-message",
            message: JSON.stringify(mostRecentMessage),
          });
        },
      });

      return stream(c, (stream) => stream.pipe(streamWithMessage));
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
  stream: DataStreamWriter,
): Promise<Message[]> {
  let messages = resolvePendingTools(inputMessages);
  messages = injectReadEnvironment(messages, model, environment, event);
  messages = await resolveServerTools(messages, user, stream);
  return messages;
}

function resolvePendingTools(inputMessages: Message[]): Message[] {
  return inputMessages.map((message) => {
    if (message.role === "assistant" && message.parts) {
      for (let i = 0; i < message.parts.length; i++) {
        const part = message.parts[i];
        if (
          part.type === "tool-invocation" &&
          part.toolInvocation.state !== "result"
        ) {
          const result = isUserInputTool(part.toolInvocation.toolName)
            ? { success: true }
            : {
                error: "User cancelled the tool call.",
              };
          part.toolInvocation = {
            ...part.toolInvocation,
            state: "result",
            result,
          };
        }
      }
    }
    return message;
  });
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

async function saveMessages(
  taskId: number,
  userId: string,
  status: DB["task"]["status"]["__select__"],
  messages: Message[],
) {
  const messagesToSave = postProcessMessages(messages);
  await taskService
    .updateMessages(taskId, userId, status, messagesToSave)
    .catch(console.error);
}
