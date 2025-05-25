import type { DBMessage, Environment, UserEvent } from "@ragdoll/common";
import { ZodEnvironment } from "@ragdoll/common";
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
  reasoning: z
    .object({
      enabled: z
        .boolean()
        .describe("Whether to enable reasoning/thinking mode"),
    })
    .optional()
    .describe("Reasoning configuration"),
  environment: ZodEnvironment,
  notify: z.boolean().optional(),
});

export type ChatRequest = z.infer<typeof ZodChatRequestType>;
export type SystemPromptEnvironment = NonNullable<Environment["info"]>;
