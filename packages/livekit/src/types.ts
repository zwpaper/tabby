import type { LanguageModelV2FinishReason } from "@ai-sdk/provider";
import { Environment } from "@getpochi/common";
import type { PochiApiClient } from "@getpochi/common/pochi-api";
import { type ClientTools, ZodMcpTool } from "@getpochi/tools";
import type { InferUITools, UIMessage } from "ai";
import z from "zod";
import type { tables } from "./livestore/schema";

type Metadata =
  | {
      kind: "assistant";
      totalTokens: number;
      finishReason: LanguageModelV2FinishReason;
    }
  | {
      kind: "user";
      compact?: boolean;
    };

export type DataParts = {
  checkpoint: {
    commit: string;
  };
};

export type UITools = InferUITools<ClientTools>;

export type Message = UIMessage<Metadata, DataParts, UITools>;

const ZodRequestData = z.object({
  environment: Environment.optional(),
  llm: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("openai"),
      modelId: z.string(),
      baseURL: z.string(),
      apiKey: z.string().optional(),
      contextWindow: z.number().describe("Context window of the model."),
      maxOutputTokens: z.number().describe("Max output tokens of the model."),
    }),
    z.object({
      type: z.literal("pochi"),
      modelId: z.string().optional(),
      modelEndpointId: z.string().optional(),
      apiClient: z.custom<PochiApiClient>(),
    }),
  ]),
  mcpToolSet: z
    .record(
      z.string().describe("Name of the MCP tool."),
      ZodMcpTool.describe("Definition of the MCP tool."),
    )
    .optional()
    .describe("MCP tools available for this request."),
});

export type RequestData = z.infer<typeof ZodRequestData>;

export type Task = typeof tables.tasks.Type;
