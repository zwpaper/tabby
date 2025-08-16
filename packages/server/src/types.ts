import type { JSONSchema7 } from "@ai-v5-sdk/ai";
import { Environment } from "@getpochi/common";
import type { DBMessage, TaskCreateEvent } from "@ragdoll/db";
import { z } from "zod";

export const ZodMessageType: z.ZodType<DBMessage> = z.any();
const ZodEventType: z.ZodType<TaskCreateEvent> = z.any();

const ZodMcpTool = z.object({
  description: z
    .string()
    .optional()
    .describe("An optional description of the MCP tool."),
  parameters: z
    .object({
      jsonSchema: z.custom<JSONSchema7>().describe("Validated json schema."),
    })
    .required()
    .describe("The parameters of the MCP tool."),
});

export type McpTool = z.infer<typeof ZodMcpTool>;

export const ZodChatRequestType = z.object({
  id: z.string().optional().describe("Task uid."),
  model: z.string().optional().describe("Model to use for this request."),
  event: ZodEventType.optional().describe("Associated event for the task."),
  message: ZodMessageType.optional().describe(
    "Message payload for the chat request.",
  ),
  messages: z
    .array(ZodMessageType)
    .optional()
    .describe("Messages to append for the chat request."),
  mcpToolSet: z
    .record(
      z.string().describe("Name of the MCP tool."),
      ZodMcpTool.describe("Definition of the MCP tool."),
    )
    .optional()
    .describe("MCP tools available for this request."),
  environment: Environment.optional().describe(
    "Execution environment settings.",
  ),
  minionId: z
    .string()
    .optional()
    .describe("The ID of the minion (remote Pochi)."),
  modelEndpointId: z
    .string()
    .optional()
    .describe("The ID of the model endpoint."),
  openAIModelOverride: z
    .object({
      baseURL: z.string(),
      apiKey: z.string().optional(),
      contextWindow: z.number().describe("Context window of the model."),
      maxOutputTokens: z.number().describe("Max output tokens of the model."),
    })
    .optional(),
  forceCompact: z.boolean().optional().describe("Force compact mode."),
});

export type ChatRequest = z.infer<typeof ZodChatRequestType>;
