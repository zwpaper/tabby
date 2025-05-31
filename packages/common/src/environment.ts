import { z } from "zod";
import { ZodTodo } from "./todo";

export const ZodEnvironment = z.object({
  currentTime: z.string().describe("The current time."),
  workspace: z
    .object({
      files: z.array(z.string()).describe("List of files in the workspace."),
      isTruncated: z.boolean().describe("Whether the file list is truncated."),
      activeTabs: z
        .array(z.string())
        .optional()
        .describe("Active editor tabs opened in the current workspace."),
      activeSelection: z
        .object({
          filepath: z
            .string()
            .describe("The path of the active file selection."),
          range: z
            .object({
              start: z
                .object({
                  line: z
                    .number()
                    .describe("The starting line number of the selection."),
                  character: z
                    .number()
                    .describe(
                      "The starting character number of the selection.",
                    ),
                })
                .describe("The start position of the selection."),
              end: z
                .object({
                  line: z
                    .number()
                    .describe("The ending line number of the selection."),
                  character: z
                    .number()
                    .describe("The ending character number of the selection."),
                })
                .describe("The end position of the selection."),
            })
            .describe("The range of the active selection."),
          content: z.string().describe("The content of the active selection."),
        })
        .optional()
        .describe("Active editor selection in the current workspace."),
      gitStatus: z
        .object({
          origin: z
            .string()
            .optional()
            .describe("The origin URL of the git repository."),
          mainBranch: z
            .string()
            .describe("The main branch of the git repository."),
          currentBranch: z
            .string()
            .describe("The current branch of the git repository."),
          status: z.string().describe("The status of the git repository."),
          recentCommits: z
            .array(z.string())
            .describe("A list of recent git commits."),
        })
        .optional()
        .describe("Git information for the current workspace."),
    })
    .describe("Information about the workspace."),
  info: z
    .object({
      cwd: z.string().describe("The current working directory."),
      shell: z.string().describe("The default shell."),
      os: z.string().describe("The operating system."),
      homedir: z.string().describe("The home directory."),
      customRules: z
        .string()
        .optional()
        .describe("Custom rules provided by the user."),
    })
    .describe("General information about the environment."),
  todos: z.array(ZodTodo).optional().describe("Todos in current task"),
});

export type Environment = z.infer<typeof ZodEnvironment>;
export type GitStatus = Environment["workspace"]["gitStatus"];
