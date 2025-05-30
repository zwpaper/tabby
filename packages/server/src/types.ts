import type { DBMessage, UserEvent } from "@ragdoll/common";
import { ZodEnvironment } from "@ragdoll/common";
import { ZodMcpToolType } from "@ragdoll/tools";
import { z } from "zod";

const ZodMessageType: z.ZodType<DBMessage> = z.any();
const ZodEventType: z.ZodType<UserEvent> = z.any();

export const ZodChatRequestType = z.object({
  id: z.string().optional(),
  model: z.string().optional(), // Added model field
  event: ZodEventType.optional(),
  message: ZodMessageType,
  tools: z
    .array(z.string())
    .optional()
    .describe("Server side tools to use with this request"),
  mcpToolSet: z
    .record(
      z.string().describe("The name of the MCP tool."),
      ZodMcpToolType.describe("The MCP tool definition."),
    )
    .optional()
    .describe("MCP tools to use with this request"),
  reasoning: z
    .object({
      enabled: z
        .boolean()
        .describe("Whether to enable reasoning/thinking mode"),
    })
    .optional()
    .describe("Reasoning configuration"),
  environment: ZodEnvironment.optional(),
  notify: z.boolean().optional(),
});

export type ChatRequest = z.infer<typeof ZodChatRequestType>;
