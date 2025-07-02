import type { DBMessage, TaskCreateEvent } from "@ragdoll/db";
import { ZodEnvironment } from "@ragdoll/db";
import { ZodMcpToolType } from "@ragdoll/tools";
import { z } from "zod";

export const ZodMessageType: z.ZodType<DBMessage> = z.any();
const ZodEventType: z.ZodType<TaskCreateEvent> = z.any();

export const ZodChatRequestType = z.object({
  id: z.string().optional().describe("Task uid."),
  sessionId: z.string().describe("Session uid, used to lock the task."),
  model: z.string().optional().describe("Model to use for this request."),
  event: ZodEventType.optional().describe("Associated event for the task."),
  message: ZodMessageType.describe("Message payload for the chat request."),
  mcpToolSet: z
    .record(
      z.string().describe("Name of the MCP tool."),
      ZodMcpToolType.describe("Definition of the MCP tool."),
    )
    .optional()
    .describe("MCP tools available for this request."),
  environment: ZodEnvironment.optional().describe(
    "Execution environment settings.",
  ),
  enableNewTask: z
    .boolean()
    .optional()
    .describe("This option is deprecated. The newTask tool is always enabled."), // FIXME(zhiming): remove this option in the future
  enableGeminiCustomToolCalls: z
    .boolean()
    .optional()
    .describe("Enable custom tool calls for Gemini models."),
});

export type ChatRequest = z.infer<typeof ZodChatRequestType>;
