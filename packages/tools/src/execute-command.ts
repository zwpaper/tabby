import { z } from "zod";
import { type ToolFunctionType, declareClientTool } from "./types";

export const executeCommand = declareClientTool({
  description:
    "Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task.",
  inputSchema: z.object({
    command: z
      .string()
      .describe(
        "The CLI command to execute. This should be valid for the current operating system.",
      ),
    cwd: z
      .string()
      .optional()
      .describe("The working directory to execute the command in."),
    requiresApproval: z
      .boolean()
      .describe(
        "Indicates whether the command requires user approval. This should be set to true if the command is not read-only or has side effects. If user has approved the command previously in the same session, this flag should be set to false.",
      ),
  }),
  outputSchema: z.object({
    output : z.string().describe("The output of the command (including stdout and stderr)."),
  }),
});

export type ExecuteCommandFunctionType = ToolFunctionType<
  typeof executeCommand
>;
