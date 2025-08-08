import {
  type FinishReason,
  type LanguageModelUsage,
  type ProviderMetadata,
  type Tool,
  type UIMessage,
  convertToModelMessages,
  jsonSchema,
  streamText,
  tool,
} from "@ai-v5-sdk/ai";
import { ClientToolsV5, type McpTool, ZodMcpTool } from "@getpochi/tools";
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

const MessageType: z.ZodType<UIMessage> = z.any();

const RequestType = z.object({
  id: z.string(),
  messages: z.array(MessageType),
  system: z.string(),
  model: z.string().optional().describe("Model to use for this request."),
  mcpToolSet: z
    .record(
      z.string().describe("Name of the MCP tool."),
      ZodMcpTool.describe("Definition of the MCP tool."),
    )
    .optional()
    .describe("MCP tools available for this request."),
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
    const modelMessages = convertToModelMessages(req.messages);
    const lastMessage = modelMessages.at(-1);
    if (validModelId.includes("anthropic") && lastMessage) {
      lastMessage.providerOptions = {
        anthropic: { cacheControl: { type: "ephemeral" } },
      };
    }

    const mcpTools = req.mcpToolSet && parseMcpToolSet(req.mcpToolSet);

    const result = streamText({
      messages: [
        {
          role: "system",
          content: req.system,
          providerOptions:
            typeof validModelId === "string" &&
            validModelId.includes("anthropic")
              ? {
                  anthropic: { cacheControl: { type: "ephemeral" } },
                }
              : undefined,
        },
        ...modelMessages,
      ],
      model,
      tools: {
        // FIXME: pass tools from client, like MCP
        ...ClientToolsV5,
        ...(mcpTools || {}),
      },
      abortSignal: c.req.raw.signal,
      ...getModelOptionsNext(validModelId),
      onFinish({ usage: inputUsage, providerMetadata, finishReason }) {
        const { usage, creditCostInput } = computeUsage(
          inputUsage,
          providerMetadata,
          validModelId,
          finishReason,
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
      },
      experimental_telemetry: {
        isEnabled: true,
        metadata: {
          "user-id": user.id,
          "user-email": user.email,
          "task-id": req.id,
          "model-id": validModelId,
        },
      },
    });

    return result.toUIMessageStreamResponse({
      messageMetadata: ({ part }) => {
        if (part.type === "finish") {
          const computeTotalTokens = () => {
            if (validModelId.includes("claude")) {
              return (
                (part.totalUsage.cachedInputTokens || 0) +
                (part.totalUsage.inputTokens || 0) +
                (part.totalUsage.outputTokens || 0)
              );
            }
            return part.totalUsage.totalTokens || 0;
          };
          return {
            totalTokens: computeTotalTokens(),
            finishReason: part.finishReason,
          };
        }
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

function parseMcpTool(mcpTool: McpTool): Tool {
  return tool({
    description: mcpTool.description,
    inputSchema: jsonSchema(mcpTool.parameters.jsonSchema),
  });
}

function parseMcpToolSet(
  mcpToolSet: Record<string, McpTool> | undefined,
): Record<string, Tool> | undefined {
  return mcpToolSet
    ? Object.fromEntries(
        Object.entries(mcpToolSet).map(([name, tool]) => [
          name,
          parseMcpTool(tool),
        ]),
      )
    : undefined;
}
