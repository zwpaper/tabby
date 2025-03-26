import { type Message } from "ai";
import { z } from "zod";

const ZodMessageType: z.ZodType<Message> = z.any();
export const ZodChatRequestType = z.object({
  id: z.string(),
  messages: z.array(ZodMessageType),
  environment: z.object({
    currentTime: z.string().optional().describe("The current time."),
  }).optional(),
});

export type ChatRequest = z.infer<typeof ZodChatRequestType>;
export type Environment = NonNullable<ChatRequest["environment"]>;