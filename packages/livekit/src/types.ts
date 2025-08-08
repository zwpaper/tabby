import type { InferUITool, UIMessage } from "@ai-v5-sdk/ai";
import type { LanguageModelV2FinishReason } from "@ai-v5-sdk/provider";
import type { ClientToolsV5 } from "@getpochi/tools";
import { ZodEnvironment } from "@ragdoll/db";
import z from "zod";
import type { tables } from "./livestore/schema";

type Metadata = {
  totalTokens: number;
  finishReason: LanguageModelV2FinishReason;
};

type DataParts = {
  checkpoint: {
    commit: string;
  };
};

type UITools = {
  [K in keyof typeof ClientToolsV5]: InferUITool<(typeof ClientToolsV5)[K]>;
};

export type Message = UIMessage<Metadata, DataParts, UITools>;

const ZodRequestData = z.object({
  environment: ZodEnvironment.optional(),
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
      token: z.string(),
    }),
  ]),
});

export type RequestData = z.infer<typeof ZodRequestData>;

export type Task = typeof tables.tasks.Type;
