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
  }),
  outputSchema: z.object({
    output: z.string().describe("The output of the executed command."),
  }),
});

export type ExecuteCommandFunctionType = ToolFunctionType<
  typeof executeCommand
>;
