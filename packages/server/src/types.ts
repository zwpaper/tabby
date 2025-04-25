import { z } from "zod";
import type { DBMessage, UserEvent } from "./db";

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
  environment: z
    .object({
      currentTime: z.string().describe("The current time."),
      workspace: z.object({
        files: z.array(z.string()),
        isTruncated: z.boolean(),
      }),
      info: z.object({
        cwd: z.string().describe("The current working directory."),
        shell: z.string().describe("The default shell."),
        os: z.string().describe("The operating system."),
        homedir: z.string().describe("The home directory."),
        customRules: z.string().optional(),
      }),
    })
    .optional(),
});

export type ChatRequest = z.infer<typeof ZodChatRequestType>;
export type Environment = NonNullable<ChatRequest["environment"]>;
export type SystemPromptEnvironment = NonNullable<
  NonNullable<ChatRequest["environment"]>["info"]
>;
