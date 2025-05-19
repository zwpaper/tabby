import { zValidator } from "@hono/zod-validator";
import { Laminar, getTracer } from "@lmnr-ai/lmnr";
import { isUserInputTool, selectServerTools } from "@ragdoll/tools";
import { ClientTools } from "@ragdoll/tools";
import {
  APICallError,
  type DataStreamWriter,
  type LanguageModel,
  type LanguageModelV1,
  type Message,
  NoSuchToolError,
  RetryError,
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
import { resolveServerTools } from "../lib/tools";
import { injectReadEnvironment } from "../prompts/environment";
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
    const { environment, model: requestedModelId = "google/gemini-2.5-pro" } =
      req;
    c.header("X-Vercel-AI-Data-Stream", "v1");
    c.header("Content-Type", "text/plain; charset=utf-8");

    const user = c.get("user");

    await checkUserQuota(user, c, requestedModelId);
    const selectedModel = checkModel(requestedModelId);

    checkWaitlist(user);

    // Prepare the tools to be used in the streamText call
    const enabledServerTools = selectServerTools(
      ["webFetch"].concat(req.tools || []),
    );

    const streamId = generateId();
    const dataStream = createDataStream({
      execute: async (stream) => {
        const { id, messages, event } = await taskService.startStreaming(
          user.id,
          streamId,
          req,
        );

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
              await taskService.finishStreaming(
                id,
                user.id,
                appendResponseMessages({
                  messages,
                  responseMessages: response.messages,
                }),
                finishReason,
                !!req.notify,
              );

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
