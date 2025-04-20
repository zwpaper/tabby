import { z } from "zod";
import type { Message } from "./db/messages";

const ZodMessageType: z.ZodType<Message> = z.any();
export const ZodChatRequestType = z.object({
  id: z.string(),
  model: z.string().optional(), // Added model field
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
