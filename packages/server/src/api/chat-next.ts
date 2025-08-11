import {
  type FinishReason,
  JsonToSseTransformStream,
  type LanguageModelUsage,
  type ProviderMetadata,
  streamText,
  wrapLanguageModel,
} from "@ai-v5-sdk/ai";
import type {
  LanguageModelV2Prompt,
  LanguageModelV2StreamPart,
} from "@ai-v5-sdk/provider";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireAuth } from "../auth";
import { checkModel, checkUserQuota } from "../lib/check-request";
import {
  type AvailableModelId,
  type CreditCostInput,
  getModelByIdNext,
  getModelOptionsNext,
} from "../lib/constants";
import { setIdleTimeout } from "../server";
import { usageService } from "../service/usage";

const ZodPromptType: z.ZodType<LanguageModelV2Prompt> = z.any();

const RequestType = z.object({
  id: z.string().optional(),
  model: z.string().optional().describe("Model to use for this request."),
  prompt: ZodPromptType,
  stopSequences: z.array(z.string()).optional(),
});

const chat = new Hono()
  .use(requireAuth())
  .post("/stream", zValidator("json", RequestType), async (c) => {
    setIdleTimeout(c.req.raw, 120);

    const req = await c.req.valid("json");
    const validModelId = checkModel(req.model || "google/gemini-2.5-pro");

    const user = c.get("user");
    const remainingFreeCredit =
      (await checkUserQuota(user, validModelId))?.remainingFreeCredit || 0;

    const model = getModelByIdNext(validModelId);
    if (validModelId.includes("anthropic")) {
      const lastMessage = req.prompt.at(-1);
      if (lastMessage) {
        lastMessage.providerOptions = {
          anthropic: { cacheControl: { type: "ephemeral" } },
        };
      }

      if (req.prompt[0].role === "system") {
        req.prompt[0].providerOptions = {
          anthropic: { cacheControl: { type: "ephemeral" } },
        };
      }
    }

    const abortSignal = c.req.raw.signal;
    const stream = await new Promise<ReadableStream<LanguageModelV2StreamPart>>(
      (resolve) => {
        streamText({
          messages: req.prompt,
          abortSignal,
          model: wrapLanguageModel({
            model,
            middleware: {
              middlewareVersion: "v2",
              async wrapStream() {
                const { stream, ...rest } = await model.doStream({
                  prompt: req.prompt,
                  temperature: 0.7,
                  abortSignal,
                  stopSequences: req.stopSequences,
                  ...getModelOptionsNext(validModelId),
                });

                const [stream1, stream2] = stream.tee();
                resolve(stream2);
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
      },
    );

    const sseStream = stream
      .pipeThrough(
        new TransformStream<
          LanguageModelV2StreamPart,
          LanguageModelV2StreamPart
        >({
          transform(chunk, controller) {
            controller.enqueue(chunk);
            if (chunk.type === "finish") {
              const { usage, creditCostInput } = computeUsage(
                chunk.usage,
                chunk.providerMetadata,
                validModelId,
                chunk.finishReason,
              );
              usageService.trackUsage(
                user,
                validModelId,
                {
                  promptTokens: usage.inputTokens || 0,
                  completionTokens: usage.outputTokens || 0,
                  totalTokens: usage.totalTokens || 0,
                },
                creditCostInput,
                remainingFreeCredit,
              );
            }
          },
        }),
      )
      .pipeThrough(new JsonToSseTransformStream());

    return new Response(sseStream.pipeThrough(new TextEncoderStream()), {
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
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
