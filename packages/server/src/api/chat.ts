import {
  type FinishReason,
  JsonToSseTransformStream,
  type LanguageModelUsage,
  NoSuchToolError,
  type ProviderMetadata,
  type StreamTextResult,
  type ToolSet,
  streamText,
  wrapLanguageModel,
} from "@ai-v5-sdk/ai";
import type { LanguageModelV2StreamPart } from "@ai-v5-sdk/provider";
import {
  ModelGatewayRequest,
  PersistRequest,
} from "@getpochi/common/pochi-api";
import type { Message } from "@getpochi/livekit";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { type User, isInternalUser, requireAuth } from "../auth";
import { checkModel, checkUserQuota } from "../lib/check-request";
import {
  type AvailableModelId,
  type CreditCostInput,
  getModelById,
  getModelOptions,
} from "../lib/constants";
import { setIdleTimeout } from "../server";
import { taskService } from "../service/task";
import { usageService } from "../service/usage";
import { spanConfig } from "../trace";

const chat = new Hono()
  .use(requireAuth())
  .post("/stream", zValidator("json", ModelGatewayRequest), async (c) => {
    setIdleTimeout(c.req.raw, 120);
    const req = await c.req.valid("json");
    const { prompt, tools, stopSequences } = req.callOptions;
    const validModelId = checkModel(req.model || "google/gemini-2.5-pro");
    if (req.id) {
      spanConfig.setAttribute("ragdoll.task.uid", req.id);
    }

    const user = c.get("user");
    const remainingFreeCredit =
      (await checkUserQuota(user, validModelId))?.remainingFreeCredit || 0;

    if (req.modelEndpointId && !isInternalUser(user)) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    const model = getModelById(validModelId, req.modelEndpointId);
    if (validModelId.includes("anthropic")) {
      const lastMessage = prompt.at(-1);
      if (lastMessage) {
        lastMessage.providerOptions = {
          anthropic: { cacheControl: { type: "ephemeral" } },
        };
      }

      if (prompt[0].role === "system") {
        prompt[0].providerOptions = {
          anthropic: { cacheControl: { type: "ephemeral" } },
        };
      }
    }

    const abortSignal = c.req.raw.signal;
    const { streamTextResult, stream } = await new Promise<{
      streamTextResult: StreamTextResult<ToolSet, never>;
      stream: ReadableStream<LanguageModelV2StreamPart>;
    }>((resolve) => {
      const streamTextResult = streamText({
        messages: prompt,
        abortSignal,
        stopSequences,
        onError({ error }) {
          if (NoSuchToolError.isInstance(error)) {
            // ignore as we don't really pass tools to stream text, but hook to doStream instead.
          }

          throw error;
        },
        model: wrapLanguageModel({
          model,
          middleware: {
            middlewareVersion: "v2",
            async wrapStream() {
              const { stream, ...rest } = await model.doStream({
                prompt,
                temperature: 0.7,
                abortSignal,
                stopSequences,
                tools,
                ...getModelOptions(validModelId),
              });

              const [stream1, stream2] = stream.tee();
              resolve({
                streamTextResult,
                stream: stream2,
              });
              return {
                stream: stream1,
                ...rest,
              };
            },
          },
        }),
        maxRetries: 0,
        experimental_telemetry: {
          isEnabled: true,
          metadata: {
            "user-id": user.id,
            "user-email": user.email,
            "model-id": validModelId,
            ...(req.id
              ? {
                  "task-id": req.id,
                }
              : {}),
          },
        },
      });
    });

    const sseStream = stream
      .pipeThrough(ensureStreamTextFinish(streamTextResult))
      .pipeThrough(
        createUsageTrackingTransform(user, remainingFreeCredit, validModelId),
      )
      .pipeThrough(new JsonToSseTransformStream());

    return new Response(sseStream.pipeThrough(new TextEncoderStream()), {
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  })
  .post("/persist", zValidator("json", PersistRequest), async (c) => {
    const req = c.req.valid("json");
    const user = c.get("user");
    const shareId = await taskService.persistTask(
      user.id,
      req.id,
      req.status,
      req.messages as Message[],
      req.environment,
      req.parentClientTaskId,
    );
    return c.json({ shareId });
  });

export default chat;

function computeUsage(
  inputUsage: LanguageModelUsage,
  providerMetadata: ProviderMetadata | undefined,
  validModelId: AvailableModelId,
  finishReason: FinishReason,
) {
  let usage = inputUsage;
  let creditCostInput: CreditCostInput | undefined;
  if (
    finishReason === "error" ||
    usage.inputTokens === undefined ||
    usage.outputTokens === undefined
  ) {
    return { usage, creditCostInput };
  }

  if (providerMetadata?.anthropic) {
    const cacheCreationInputTokens =
      (providerMetadata.anthropic.cache_creation_input_tokens as
        | number
        | undefined) || 0;
    const cacheReadInputTokens = usage.cachedInputTokens || 0;
    creditCostInput = {
      type: "anthropic",
      modelId: "claude-4-sonnet",
      cacheWriteInputTokens: cacheCreationInputTokens,
      cacheReadInputTokens,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    };

    const inputTokens = cacheReadInputTokens + usage.inputTokens;
    usage = {
      ...inputUsage,
      inputTokens,
      totalTokens: inputTokens + usage.outputTokens,
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

    const cacheReadInputTokens = usage.cachedInputTokens || 0;
    creditCostInput = {
      type: "google",
      modelId: modelIdFromValidModelId(),
      cacheReadInputTokens,
      inputTokens: usage.inputTokens - cacheReadInputTokens,
      outputTokens: usage.outputTokens,
    };
  } else if (validModelId === "moonshotai/kimi-k2") {
    creditCostInput = {
      type: "groq",
      modelId: "moonshotai/kimi-k2-instruct",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    };
  } else if (
    validModelId === "qwen/qwen3-coder" ||
    validModelId === "zai/glm-4.5"
  ) {
    creditCostInput = {
      type: "deepinfra",
      modelId: validModelId,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    };
  } else {
    throw new HTTPException(500, {
      message: `Model: ${validModelId} is not properly supported.`,
    });
  }

  return { usage, creditCostInput };
}

function createUsageTrackingTransform(
  user: User,
  remainingFreeCredit: number,
  modelId: AvailableModelId,
) {
  return new TransformStream<
    LanguageModelV2StreamPart,
    LanguageModelV2StreamPart
  >({
    async transform(chunk, controller) {
      if (chunk.type !== "finish") {
        controller.enqueue(chunk);
        return;
      }

      if (chunk.type === "finish") {
        const { usage, creditCostInput } = computeUsage(
          chunk.usage,
          chunk.providerMetadata,
          modelId,
          chunk.finishReason,
        );
        controller.enqueue({ ...chunk, usage });
        usageService.trackUsage(
          user,
          modelId,
          {
            inputTokens: usage.inputTokens || 0,
            outputTokens: usage.outputTokens || 0,
            totalTokens: usage.totalTokens || 0,
          },
          creditCostInput,
          remainingFreeCredit,
        );
      }
    },
  });
}

function ensureStreamTextFinish(
  streamTextResult: StreamTextResult<ToolSet, never>,
) {
  return new TransformStream<
    LanguageModelV2StreamPart,
    LanguageModelV2StreamPart
  >({
    async transform(chunk, controller) {
      controller.enqueue(chunk);

      if (chunk.type === "finish") {
        streamTextResult.toUIMessageStream().pipeTo(new WritableStream());
      }
    },
  });
}
