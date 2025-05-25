import { z } from "zod";
import { ZodTodo } from "./todo";

export const ZodEnvironment = z.object({
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
  todos: z.array(ZodTodo).optional().describe("Todos in current task"),
});

export type Environment = z.infer<typeof ZodEnvironment>;
