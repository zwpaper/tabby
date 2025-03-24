import { z } from "zod";
import { type ToolFunctionType, declareClientTool } from "./types";

export const attemptCompletion = declareClientTool({
  description: `After each tool use, the user will respond with the result of that tool use. Once you've received the results of tool uses and can confirm that the task is complete, use this tool to present the result of your work to the user.
IMPORTANT NOTE: This tool CANNOT be used until you've confirmed from the user that any previous tool uses were successful. Failure to do so will result in code corruption and system failure. Before using this tool, you must ask yourself in <thinking></thinking> tags if you've confirmed from the user that any previous tool uses were successful. If not, then DO NOT use this tool.
`,
  inputSchema: z.object({
    result: z
      .string()
      .describe(
        "The result of the task. Formulate this result in a way that is final and does not require further input from the user.",
      ),
    command: z
      .string()
      .optional()
      .describe(
        "A CLI command to execute to show a live demo of the result to the user.",
      ),
  }),
  outputSchema: z.void(),
});

export type AttemptCompletionFunctionType = ToolFunctionType<
  typeof attemptCompletion
>;
