import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { jsonSchema } from "@ai-sdk/ui-utils";
import {
  type McpTool,
  selectClientTools,
  selectServerTools,
} from "@getpochi/tools";
import { zValidator } from "@hono/zod-validator";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { appendDataPart, formatters, prompts } from "@ragdoll/common";
import type { DBMessage, Environment } from "@ragdoll/db";
import {
  type CoreMessage,
  type DataStreamWriter,
  type FinishReason,
  type LanguageModelUsage,
  type LanguageModelV1,
  type LanguageModelV1Middleware,
  NoSuchToolError,
  type ProviderMetadata,
  type Tool,
  type UIMessage,
  appendResponseMessages,
  createDataStream,
  generateObject,
  streamText,
  tool,
  wrapLanguageModel,
} from "ai";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { stream } from "hono/streaming";
import { createResumableStreamContext } from "resumable-stream";
import { z } from "zod";
import { type User, isInternalUser, requireAuth } from "../auth";
import { createBatchCallMiddleware } from "../lib/batch-call-middleware";
import { checkModel, checkUserQuota } from "../lib/check-request";
import {
  type AvailableModelId,
  AvailableModels,
  type CreditCostInput,
  geminiFlash,
  getModelById,
  getModelOptions,
} from "../lib/constants";
import {
  type NewTaskMiddlewareContext,
  createNewTaskMiddleware,
} from "../lib/new-task-middleware";
import { createReasoningMiddleware } from "../lib/reasoning-middleware";
import { createToolMiddleware } from "../lib/tool-call-middleware";
import { resolveServerTools } from "../lib/tools";
import { setIdleTimeout, waitUntil } from "../server";
import { taskService } from "../service/task";
import { usageService } from "../service/usage";
import { type ChatRequest, ZodChatRequestType } from "../types";

const streamContext = createResumableStreamContext({
  waitUntil,
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

    if (req.modelEndpointId && !isInternalUser(user)) {
      throw new HTTPException(403, {
        message: "modelEndpointId is only available for internal users.",
      });
    }

    const validModelId =
      req.openAIModelOverride || checkModel(requestedModelId);

    const { streamId, messages, uid, isSubTask, compact } =
      await taskService.startStreaming(
        user.id,
        req,
        getContextWindow(validModelId),
      );

    let remainingFreeCredit = 0;
    try {
      checkDebugErrorTrigger(req.messages);
      if (!req.openAIModelOverride) {
        remainingFreeCredit =
          (await checkUserQuota(user, requestedModelId))?.remainingFreeCredit ||
          0;
      }
    } catch (error) {
      const taskError = taskService.toTaskError(error);
      await taskService.failStreaming(uid, user.id, taskError);

      throw error;
    }

    const enabledClientTools = selectClientTools(!isSubTask);

    // Prepare the tools to be used in the streamText call
    const enabledServerTools = selectServerTools(["webFetch", "batchCall"]);

    const middlewareContext = {
      newTask: isSubTask ? undefined : { userId: user.id, parentId: uid },
    };

    const selectedModel = createModel(
      validModelId,
      middlewareContext,
      requestedModelId,
      req.modelEndpointId,
    );

    const dataStream = createDataStream({
      execute: async (stream) => {
        if (req.id === undefined) {
          appendDataPart({ type: "append-id", uid }, stream);
        }

        if (compact) {
          const lastMessage = messages.at(-1);
          if (lastMessage) {
            appendDataPart(
              {
                type: "compact",
                message: JSON.stringify(lastMessage),
              },
              stream,
            );
          }
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
        const result = streamText({
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
                    content: prompts.system(environment.info.customRules),
                    providerOptions:
                      typeof validModelId === "string" &&
                      validModelId.includes("anthropic")
                        ? {
                            anthropic: { cacheControl: { type: "ephemeral" } },
                          }
                        : undefined,
                  } satisfies CoreMessage,
                ]
              : []),
            ...formatters.llm(preparedMessages, {
              tools,
              isClaude: requestedModelId.includes("claude"),
            }),
          ],
          tools,
          // FIXME(meng): onFinish adds ~1 second latency after stream finished.
          // Optimize this to: move some workload to background (return instead of await).
          onFinish: async ({
            usage: inputUsage,
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
            const { usage, creditCostInput } = computeUsage(
              inputUsage,
              providerMetadata,
              validModelId,
              finishReason,
            );

            const isUsageValid = !Number.isNaN(usage.totalTokens);

            await taskService.finishStreaming(
              uid,
              user.id,
              finalMessages,
              finishReason,
              isUsageValid ? usage.totalTokens : undefined,
            );

            if (isUsageValid) {
              appendDataPart(
                {
                  type: "update-usage",
                  ...usage,
                },
                stream,
              );

              await usageService.trackUsage(
                user,
                requestedModelId,
                usage,
                creditCostInput,
                remainingFreeCredit,
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
            metadata: {
              "user-id": user.id,
              "user-email": user.email,
              "task-id": uid,
              "model-id":
                typeof validModelId === "string"
                  ? validModelId
                  : requestedModelId,
            },
          },

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
              model: geminiFlash,
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
              },
            });

            return { ...toolCall, args: JSON.stringify(repairedArgs) };
          },
        });

        result.mergeIntoDataStream(stream, {
          sendReasoning: true,
        });
      },
      onError(error) {
        const span = trace.getActiveSpan();
        if (span) {
          if (error instanceof Error) {
            span.recordException(error);
          }
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: String(error),
          });
        }

        // Failed to stream the response.
        const taskError = taskService.toTaskError(error);
        taskService.failStreaming(uid, user.id, taskError);

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
  messages = prompts.injectEnvironmentDetails(messages, environment, user);
  return messages;
}

export default chat;

interface MiddlewareContext {
  newTask?: NewTaskMiddlewareContext;
}

function createModel(
  modelId: AvailableModelId | NonNullable<ChatRequest["openAIModelOverride"]>,
  middlewareContext: MiddlewareContext,
  requestedModelId: string,
  modelEndpointId?: string,
): LanguageModelV1 {
  let model: LanguageModelV1;
  if (typeof modelId === "string") {
    model = getModelById(modelId, modelEndpointId);
  } else {
    const provider = createOpenAICompatible({
      name: "BYOK",
      baseURL: modelId.baseURL,
      apiKey: modelId.apiKey,
    });
    model = provider(requestedModelId);
  }

  // Create middlewares
  // Order matters, execution order is from last to first.
  const middleware: LanguageModelV1Middleware[] = [];
  if (typeof modelId === "string" && modelId === "zai/glm-4.5") {
    middleware.push(createReasoningMiddleware("think"));
  }

  if (middlewareContext.newTask) {
    middleware.push(createNewTaskMiddleware(middlewareContext.newTask));
  }

  middleware.push(createBatchCallMiddleware());

  middleware.push(createToolMiddleware());
  return wrapLanguageModel({
    model,
    middleware,
  });
}

function getContextWindow(
  modelId: AvailableModelId | NonNullable<ChatRequest["openAIModelOverride"]>,
) {
  if (typeof modelId === "string") {
    const model = AvailableModels.find((m) => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} is not valid`);
    }
    return model.contextWindow;
  }

  return modelId.contextWindow;
}

function checkDebugErrorTrigger(messages: DBMessage[] | undefined) {
  if (!messages?.length) return;

  const triggerPrefix = "RAGDOLL_DEBUG_TRIGGER_ERROR";
  const lastMessage = messages.at(-1);
  const text =
    lastMessage?.parts[0].type === "text"
      ? lastMessage?.parts[0].text
      : undefined;

  if (text?.startsWith(triggerPrefix)) {
    const rest = text.substring(triggerPrefix.length);

    if (rest.startsWith(":")) {
      const errorMessage = rest.substring(1).trim();
      if (errorMessage) {
        throw new HTTPException(400, { message: errorMessage });
      }
    }

    throw new HTTPException(400, { message: "Invalid model" });
  }
}

function computeUsage(
  inputUsage: LanguageModelUsage,
  providerMetadata: ProviderMetadata | undefined,
  validModelId:
    | AvailableModelId
    | NonNullable<ChatRequest["openAIModelOverride"]>,
  finishReason: FinishReason,
) {
  let usage = inputUsage;
  let creditCostInput: CreditCostInput | undefined;
  if (finishReason === "error") {
    return {
      usage,
      creditCostInput,
    };
  }

  if (providerMetadata?.anthropic) {
    const cacheCreationInputTokens =
      (providerMetadata.anthropic.cacheCreationInputTokens as
        | number
        | undefined) || 0;
    const cacheReadInputTokens =
      (providerMetadata.anthropic.cacheReadInputTokens as number | undefined) ||
      0;
    creditCostInput = {
      type: "anthropic",
      modelId: "claude-4-sonnet",
      cacheWriteInputTokens: cacheCreationInputTokens,
      cacheReadInputTokens,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
    };

    const promptTokens =
      (cacheReadInputTokens || cacheCreationInputTokens) + usage.promptTokens;
    usage = {
      promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: promptTokens + usage.completionTokens,
    };
  } else if (providerMetadata?.google) {
    const modelIdFromValidModelId = () => {
      if (typeof validModelId !== "string")
        throw new Error("Unsupported model");

      switch (validModelId) {
        case "google/gemini-2.5-flash":
        case "pochi/pro-1":
          return "gemini-2.5-flash";
        case "google/gemini-2.5-pro":
        case "pochi/max-1":
          return "gemini-2.5-pro";
        default:
          throw new Error(`Non google model: ${validModelId}`);
      }
    };

    const cacheReadInputTokens =
      (providerMetadata.google.cachedContentTokenCount as number | undefined) ||
      0;
    creditCostInput = {
      type: "google",
      modelId: modelIdFromValidModelId(),
      cacheReadInputTokens,
      inputTokens: usage.promptTokens - cacheReadInputTokens,
      outputTokens: usage.completionTokens,
    };
  } else if (validModelId === "moonshotai/kimi-k2") {
    creditCostInput = {
      type: "groq",
      modelId: "moonshotai/kimi-k2-instruct",
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
    };
  } else if (
    validModelId === "qwen/qwen3-coder" ||
    validModelId === "zai/glm-4.5"
  ) {
    creditCostInput = {
      type: "deepinfra",
      modelId: validModelId,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
    };
  } else if (typeof validModelId !== "string") {
    // Custom model, do nothing.
  } else {
    throw new HTTPException(500, {
      message: `Model: ${validModelId} is not properly supported.`,
    });
  }

  return {
    creditCostInput,
    usage,
  };
}

function parseMcpTool(name: string, mcpTool: McpTool): Tool {
  let toToolResultContent: Tool["experimental_toToolResultContent"];
  if (name === "browser_take_screenshot") {
    toToolResultContent = (result) => {
      return result.content;
    };
  }
  return tool({
    description: mcpTool.description,
    parameters: jsonSchema(mcpTool.inputSchema.jsonSchema),
    experimental_toToolResultContent: toToolResultContent,
  });
}

function parseMcpToolSet(
  mcpToolSet: Record<string, McpTool> | undefined,
): Record<string, Tool> | undefined {
  return mcpToolSet
    ? Object.fromEntries(
        Object.entries(mcpToolSet).map(([name, tool]) => [
          name,
          parseMcpTool(name, tool),
        ]),
      )
    : undefined;
}
