import type { DBMessage, TaskCreateEvent } from "@ragdoll/db";
import { ZodEnvironment } from "@ragdoll/db";
import { ZodMcpToolType } from "@ragdoll/tools";
import { z } from "zod";

export const ZodMessageType: z.ZodType<DBMessage> = z.any();
const ZodEventType: z.ZodType<TaskCreateEvent> = z.any();

export const ZodChatRequestType = z.object({
  id: z.string().optional(),
  model: z.string().optional(), // Added model field
  event: ZodEventType.optional(),
  message: ZodMessageType,
  mcpToolSet: z
    .record(
      z.string().describe("The name of the MCP tool."),
      ZodMcpToolType.describe("The MCP tool definition."),
    )
    .optional()
    .describe("MCP tools to use with this request"),
  environment: ZodEnvironment.optional(),
  enableNewTask: z
    .boolean()
    .optional()
    .describe("Enable the newTask tool for this request"),
  enableGeminiCustomToolCalls: z
    .boolean()
    .optional()
    .describe("Enable custom tool calls for Gemini models"),
});

export type ChatRequest = z.infer<typeof ZodChatRequestType>;
