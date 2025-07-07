import { google } from "@ai-sdk/google";
import { jsonSchema } from "@ai-sdk/ui-utils";
import { zValidator } from "@hono/zod-validator";
import { Laminar, getTracer } from "@lmnr-ai/lmnr";
import { appendDataPart, formatters, prompts } from "@ragdoll/common";
import type { Environment } from "@ragdoll/db";
import {
  parseMcpToolSet,
  selectClientTools,
  selectServerTools,
} from "@ragdoll/tools";
import {
  type CoreMessage,
  type DataStreamWriter,
  type LanguageModelV1,
  type LanguageModelV1Middleware,
  NoSuchToolError,
  type UIMessage,
  appendResponseMessages,
  createDataStream,
  generateObject,
  streamText,
  wrapLanguageModel,
} from "ai";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { stream } from "hono/streaming";
import { createResumableStreamContext } from "resumable-stream";
import { z } from "zod";
import { type User, requireAuth } from "../auth";
import { createBatchCallMiddleware } from "../lib/batch-call-middleware";
import {
  checkModel,
  checkUserQuota,
  checkWaitlist,
} from "../lib/check-request";
import {
  type AvailableModelId,
  type CreditCostInput,
  getModelById,
  getModelOptions,
} from "../lib/constants";
import {
  type NewTaskMiddlewareContext,
  createNewTaskMiddleware,
} from "../lib/new-task-middleware";
import { createToolMiddleware } from "../lib/tool-call-middleware";
import { resolveServerTools } from "../lib/tools";
import { after, setIdleTimeout } from "../server";
import { taskService } from "../service/task";
import { usageService } from "../service/usage";
import { ZodChatRequestType } from "../types";

const streamContext = createResumableStreamContext({
  waitUntil: after,
});

const EnableInterleavedThinking = true;

const chat = new Hono()
  .use(requireAuth())
  .post("/stream", zValidator("json", ZodChatRequestType), async (c) => {
    setIdleTimeout(c.req.raw, 120);

    const req = await c.req.valid("json");
    const {
      environment,
      mcpToolSet,
      model: requestedModelId = "google/gemini-2.5-pro",
    } = req;
    c.header("X-Vercel-AI-Data-Stream", "v1");
    c.header("Content-Type", "text/plain; charset=utf-8");

    const parsedMcpTools = parseMcpToolSet(mcpToolSet);

    const user = c.get("user");

    await checkUserQuota(user, requestedModelId);
    const validModelId = checkModel(requestedModelId);

    checkWaitlist(user);

    const { streamId, messages, uid, isSubTask } =
      await taskService.startStreaming(user.id, req);

    const enabledClientTools = selectClientTools(!isSubTask);

    // Prepare the tools to be used in the streamText call
    const enabledServerTools = selectServerTools(["webFetch", "batchCall"]);

    const middlewareContext = {
      newTask: isSubTask ? undefined : { userId: user.id, parentId: uid },
    };

    const selectedModel = createModel(validModelId, middlewareContext);

    const dataStream = createDataStream({
      execute: async (stream) => {
        if (req.id === undefined) {
          appendDataPart({ type: "append-id", uid }, stream);
        }

        const preparedMessages = await prepareMessages(
          messages,
          environment,
          user,
          stream,
        );

        const tools = {
          ...enabledClientTools,
          ...enabledServerTools,
          ...parsedMcpTools,
        };

        const modelOptions = getModelOptions(validModelId);
        const result = Laminar.withSession(`${user.id}-${uid}`, () =>
          streamText({
            ...modelOptions,
            abortSignal: c.req.raw.signal,
            temperature: 0.8,
            toolCallStreaming: true,
            model: selectedModel,
            messages: [
              ...(environment?.info
                ? [
                    {
                      role: "system",
                      content: prompts.system(environment.info),
                      providerOptions: {
                        anthropic: { cacheControl: { type: "ephemeral" } },
                      },
                    } satisfies CoreMessage,
                  ]
                : []),
              ...formatters.llm(preparedMessages, {
                tools,
                isGemini: validModelId.includes("google"),
              }),
            ],
            tools,
            onFinish: async ({
              usage,
              finishReason,
              response,
              providerMetadata,
            }) => {
              if (finishReason === "length") {
                throw new Error("The response was too long.");
              }

              const finalMessages = appendResponseMessages({
                messages: preparedMessages,
                responseMessages: response.messages,
              }) as UIMessage[];
              let creditCostInput: CreditCostInput | undefined;
              if (providerMetadata?.anthropic) {
                const cacheCreationInputTokens =
                  (providerMetadata.anthropic.cacheCreationInputTokens as
                    | number
                    | undefined) || 0;
                const cacheReadInputTokens =
                  (providerMetadata.anthropic.cacheReadInputTokens as
                    | number
                    | undefined) || 0;
                creditCostInput = {
                  type: "anthropic",
                  modelId: "claude-4-sonnet",
                  cacheWriteInputTokens: cacheCreationInputTokens,
                  cacheReadInputTokens,
                  inputTokens: usage.promptTokens,
                  outputTokens: usage.completionTokens,
                };

                const promptTokens =
                  (cacheReadInputTokens || cacheCreationInputTokens) +
                  usage.promptTokens;
                usage = {
                  promptTokens,
                  completionTokens: usage.completionTokens,
                  totalTokens: promptTokens + usage.completionTokens,
                };
              }

              if (providerMetadata?.google) {
                const cacheReadInputTokens =
                  (providerMetadata.google.cachedContentTokenCount as
                    | number
                    | undefined) || 0;
                creditCostInput = {
                  type: "google",
                  modelId:
                    validModelId === "google/gemini-2.5-pro"
                      ? "gemini-2.5-pro"
                      : "gemini-2.5-flash",
                  cacheReadInputTokens,
                  inputTokens: usage.promptTokens - cacheReadInputTokens,
                  outputTokens: usage.completionTokens,
                };
              }

              if (!creditCostInput) {
                throw new Error(
                  "Failed to determine credit cost input for usage tracking.",
                );
              }

              const isUsageValid = !Number.isNaN(usage.totalTokens);

              await taskService.finishStreaming(
                uid,
                user.id,
                finalMessages,
                finishReason,
                isUsageValid ? usage.totalTokens : undefined,
              );

              if (isUsageValid) {
                await usageService.trackUsage(
                  user,
                  requestedModelId,
                  usage,
                  creditCostInput,
                );

                appendDataPart(
                  {
                    type: "update-usage",
                    ...usage,
                  },
                  stream,
                );
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
                "task-id": uid,
              },
            },
            // Disallowing the model to repeat the environment details from our injection.
            // see injectEnvironmentDetails for more details.
            stopSequences: [`<${prompts.EnvironmentDetailsTag}>`],

            // Disable retries as we handle them ourselves.
            maxRetries: 0,

            experimental_repairToolCall: async ({
              toolCall,
              parameterSchema,
              error,
            }) => {
              if (NoSuchToolError.isInstance(error)) {
                return null; // do not attempt to fix invalid tool names
              }

              const { object: repairedArgs } = await generateObject({
                model: google("gemini-2.5-flash"),
                schema: jsonSchema(parameterSchema(toolCall)),
                prompt: [
                  `The model tried to call the tool "${toolCall.toolName}" with the following arguments:`,
                  JSON.stringify(toolCall.args),
                  "The tool accepts the following schema:",
                  JSON.stringify(parameterSchema(toolCall)),
                  "Please fix the arguments.",
                ].join("\n"),
                experimental_telemetry: {
                  isEnabled: true,
                  tracer: getTracer(),
                },
              });

              return { ...toolCall, args: JSON.stringify(repairedArgs) };
            },
          }),
        );

        result.mergeIntoDataStream(stream, {
          sendReasoning: true,
        });
      },
      onError(error) {
        // Failed to stream the response.
        const taskError = taskService.toTaskError(error);
        taskService.failStreaming(uid, user.id, taskError);

        if (taskError.kind === "APICallError") {
          console.log(
            "API call error",
            taskError.message,
            taskError.requestBodyValues,
          );
        }

        return taskError.message;
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

    c.header("Pochi-Task-Id", uid);
    return stream(c, (stream) => stream.pipe(resumableStream));
  })
  .get(
    "/stream",
    zValidator("query", z.object({ chatId: z.string() })),
    async (c) => {
      setIdleTimeout(c.req.raw, 120);

      const { chatId: uid } = c.req.valid("query");
      const user = c.get("user");
      c.header("X-Vercel-AI-Data-Stream", "v1");
      c.header("Content-Type", "text/plain; charset=utf-8");

      const streamId = await taskService.fetchLatestStreamId(uid, user.id);
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

      const task = await taskService.get(uid, user.id);
      const mostRecentMessage = task?.conversation?.messages?.at(-1);
      if (!mostRecentMessage || mostRecentMessage.role !== "assistant") {
        return stream(c, (stream) => stream.pipe(emptyDataStream));
      }

      const streamWithMessage = createDataStream({
        execute: (buffer) => {
          appendDataPart(
            {
              type: "append-message",
              message: JSON.stringify(mostRecentMessage),
            },
            buffer,
          );
        },
      });

      return stream(c, (stream) => stream.pipe(streamWithMessage));
    },
  );

async function prepareMessages(
  inputMessages: UIMessage[],
  environment: Environment | undefined,
  user: User,
  stream: DataStreamWriter,
): Promise<UIMessage[]> {
  let messages = await resolveServerTools(inputMessages, user, stream);
  messages = prompts.injectEnvironmentDetails(
    messages,
    environment,
    process.env.POCHI_INJECT_ENVIRONMENT_DETAILS_MODE === "assistant",
  );
  return messages;
}

export default chat;

interface MiddlewareContext {
  newTask?: NewTaskMiddlewareContext;
}

function createModel(
  modelId: AvailableModelId,
  middlewareContext: MiddlewareContext,
): LanguageModelV1 {
  const model = getModelById(modelId);

  // Create middlewares
  const middleware: LanguageModelV1Middleware[] = [];

  middleware.push(createBatchCallMiddleware());

  if (middlewareContext.newTask) {
    middleware.push(createNewTaskMiddleware(middlewareContext.newTask));
  }

  if (modelId.includes("google/gemini-2.5")) {
    middleware.push(createToolMiddleware());
  }
  return wrapLanguageModel({
    model,
    middleware,
  });
}
