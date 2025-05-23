import type { ClientToolsType } from "@ragdoll/tools";
import { z } from "zod";
import type { DBMessage, UserEvent } from "./db";

const ZodMessageType: z.ZodType<DBMessage> = z.any();
const ZodEventType: z.ZodType<UserEvent> = z.any();
const ZodTodoType: z.ZodType<Todo> = z.any();

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
  environment: z
    .object({
      currentTime: z.string().describe("The current time."),
      workspace: z.object({
        files: z.array(z.string()),
        isTruncated: z.boolean(),
        activeTabs: z
          .array(z.string())
          .optional()
          .describe("Active editor tabs opened in the current workspace."),
        activeSelection: z
          .object({
            filepath: z.string(),
            range: z.object({
              start: z.object({
                line: z.number(),
                character: z.number(),
              }),
              end: z.object({
                line: z.number(),
                character: z.number(),
              }),
            }),
            content: z.string(),
          })
          .optional()
          .describe("Active editor selection in the current workspace."),
      }),
      info: z.object({
        cwd: z.string().describe("The current working directory."),
        shell: z.string().describe("The default shell."),
        os: z.string().describe("The operating system."),
        homedir: z.string().describe("The home directory."),
        customRules: z.string().optional(),
        gitStatus: z
          .string()
          .optional()
          .describe("Git status information for the current workspace."),
      }),
      todos: z.array(ZodTodoType).optional().describe("Todos in current task"),
    })
    .optional(),
  notify: z.boolean().optional(),
});

export type ChatRequest = z.infer<typeof ZodChatRequestType>;
export type Environment = NonNullable<ChatRequest["environment"]>;
export type SystemPromptEnvironment = NonNullable<
  NonNullable<ChatRequest["environment"]>["info"]
>;
export type Todo = z.infer<
  ClientToolsType["todoWrite"]["parameters"]
>["todos"][number];
