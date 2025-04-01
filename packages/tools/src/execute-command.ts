import { z } from "zod";
import {
  type ToolFunctionType,
  type ToolInputType,
  type ToolOutputType,
  declareClientTool,
} from "./types";

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
        "Indicates whether the command requires user approval. This should be set to true if the command is not read-only or has side effects.",
      ),
  }),
  outputSchema: z.object({
    stdout: z.string().describe("The standard output of the command."),
    stderr: z.string().describe("The standard error of the command."),
    exitCode: z
      .number()
      .describe("The exit code of the command, 0 indicates success."),
  }),
});

export type ExecuteCommandInputType = ToolInputType<typeof executeCommand>;
export type ExecuteCommandOutputType = ToolOutputType<typeof executeCommand>;
export type ExecuteCommandFunctionType = ToolFunctionType<
  typeof executeCommand
>;
