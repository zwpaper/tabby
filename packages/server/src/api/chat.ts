import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { isAbortError } from "@ai-sdk/provider-utils";
import { zValidator } from "@hono/zod-validator";
import { Laminar, getTracer } from "@lmnr-ai/lmnr";
import {
  ClientTools,
  isUserInputTool,
  selectServerTools,
} from "@ragdoll/tools";
import {
  APICallError,
  type DataStreamWriter,
  type LanguageModel,
  type Message,
  NoSuchToolError,
  RetryError,
  appendResponseMessages,
  createDataStream,
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
import {
  injectReadEnvironment,
  stripReadEnvironment,
} from "../prompts/environment";
import { generateSystemPrompt } from "../prompts/system";
import { after, setIdleTimeout } from "../server";
import { taskService } from "../service/task";
import { usageService } from "../service/usage";
import { type Environment, ZodChatRequestType } from "../types";

const streamContext = createResumableStreamContext({
  waitUntil: after,
});

export type ContextVariables = {
  model?: LanguageModel;
};

const EnableThinking = false;
const EnableInterleavedThinking = false;

const chat = new Hono<{ Variables: ContextVariables }>()
  .use(requireAuth())
  .post("/stream", zValidator("json", ZodChatRequestType), async (c) => {
    setIdleTimeout(c.req.raw, 120);
    const req = await c.req.valid("json");
    const { environment, model: requestedModelId = "google/gemini-2.5-pro" } =
      req;
    c.header("X-Vercel-AI-Data-Stream", "v1");
    c.header("Content-Type", "text/plain; charset=utf-8");

    const user = c.get("user");

    await checkUserQuota(user, c, requestedModelId);
    const selectedModel = checkModel(requestedModelId);

    checkWaitlist(user);

    const enabledClientTools = ClientTools;

    // Prepare the tools to be used in the streamText call
    const enabledServerTools = selectServerTools(
      ["webFetch"].concat(req.tools || []),
    );

    const { id, streamId, messages, event } = await taskService.startStreaming(
      user.id,
      req,
    );

    const dataStream = createDataStream({
      execute: async (stream) => {
        if (req.id === undefined) {
          stream.writeData({ type: "append-id", id });
        }

        const processedMessages = await preprocessMessages(
          messages,
          environment,
          user,
          event,
          stream,
        );

        const providerOptions = EnableThinking
          ? {
              google: {
                thinkingConfig: {
                  includeThoughts: true,
                  thinkingBudget: 1024,
                },
              } satisfies GoogleGenerativeAIProviderOptions,
              anthropic: {
                thinking: { type: "enabled", budgetTokens: 10_000 },
              } satisfies AnthropicProviderOptions,
            }
          : undefined;

        const result = Laminar.withSession(`${user.id}-${id}`, () =>
          streamText({
            abortSignal: c.req.raw.signal,
            toolCallStreaming: true,
            model: c.get("model") || selectedModel,
            system: environment?.info && generateSystemPrompt(environment.info),
            messages: processedMessages,
            tools: {
              ...enabledClientTools,
              ...enabledServerTools, // Add the enabled server tools
            },
            providerOptions,
            onFinish: async ({ usage, finishReason, response }) => {
              const finalMessages = appendResponseMessages({
                messages,
                responseMessages: response.messages,
              });
              const totalTokens = !Number.isNaN(usage.totalTokens)
                ? usage.totalTokens
                : undefined;
              await taskService.finishStreaming(
                id,
                user.id,
                finalMessages,
                finishReason,
                totalTokens,
                !!req.notify,
              );

              if (totalTokens) {
                await usageService.trackUsage(user, requestedModelId, usage);
              }
            },
            headers:
              requestedModelId.includes("claude-4") && EnableInterleavedThinking
                ? {
                    "anthropic-beta": "interleaved-thinking-2025-05-14",
                  }
                : undefined,
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

        result.mergeIntoDataStream(stream, {
          sendReasoning: true,
        });
      },
      onError(error) {
        // Failed to stream the response.
        taskService.failStreaming(id, user.id);

        const logApiCallError = (error: APICallError) => {
          console.log("API call error", error.message, error.requestBodyValues);
        };

        if (RetryError.isInstance(error)) {
          if (APICallError.isInstance(error.lastError)) {
            if (error.lastError.statusCode === 429) {
              return "Too many requests. Please try again later.";
            }

            logApiCallError(error.lastError);
            return error.message;
          }
        }

        if (APICallError.isInstance(error)) {
          logApiCallError(error);
          return error.message;
        }

        if (NoSuchToolError.isInstance(error)) {
          return `${error.toolName} is not a valid tool.`;
        }

        if (isAbortError(error)) {
          console.log("Request Aborted", error);
          return "Request was aborted.";
        }

        if (!(error instanceof Error)) {
          console.error("Unknown error", error);
          return "Something went wrong. Please try again.";
        }

        console.log("Misc error", error);
        return error.message;
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
  environment: Environment | undefined,
  user: User,
  event: DB["task"]["event"],
  stream: DataStreamWriter,
): Promise<Message[]> {
  let messages = stripReadEnvironment(inputMessages);
  messages = resolvePendingTools(messages);
  messages = injectReadEnvironment(messages, environment, event);
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
