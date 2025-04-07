import { z } from "zod";
import { type ToolFunctionType, declareClientTool } from "./types";

export const writeToFile = declareClientTool({
  description:
    "Request to write full content to a file at the specified path. If the file exists, it will be overwritten with the provided content. If the file doesn't exist, it will be created. This tool will automatically create any directories needed to write the file.",
  inputSchema: z.object({
    path: z
      .string()
      .describe(
        "The path of the file to write to (relative to the current working directory).",
      ),
    content: z.string().describe("The content to write to the file."),
  }),
  outputSchema: z.object({
    success: z
      .boolean()
      .describe("Indicates whether the file was successfully written."),
  }),
});

export type WriteToFileFunctionType = ToolFunctionType<typeof writeToFile>;
