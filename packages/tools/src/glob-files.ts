import { z } from "zod";
import {
  type ToolFunctionType,
  type ToolInputType,
  type ToolOutputType,
  declareClientTool,
} from "./types";

export const globFiles = declareClientTool({
  description:
    "Request to find files matching a glob pattern within a specified directory. Use this to get a list of files based on a pattern.",
  inputSchema: z.object({
    path: z
      .string()
      .describe(
        "The path of the directory to search in (relative to the current working directory)",
      ),
    globPattern: z
      .string()
      .describe(
        "The glob pattern to match files against (e.g., '*.ts', '**/*.js')",
      ),
  }),
  outputSchema: z.object({
    files: z
      .array(z.string())
      .describe("A list of file paths matching the glob pattern"),
    isTruncated: z
      .boolean()
      .optional()
      .describe("Whether the list of files was truncated"),
  }),
});

export type GlobFilesInputType = ToolInputType<typeof globFiles>;
export type GlobFilesOutputType = ToolOutputType<typeof globFiles>;
export type GlobFilesFunctionType = ToolFunctionType<typeof globFiles>;
