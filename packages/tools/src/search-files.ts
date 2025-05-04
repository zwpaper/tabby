import { z } from "zod";
import { defineClientTool } from "./types";

export const searchFiles = defineClientTool({
  description:
    "Request to perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.",
  inputSchema: z.object({
    path: z
      .string()
      .describe(
        "The path of the directory to search in (relative to the current working directory). This directory will be recursively searched.",
      ),
    regex: z.string().describe("The regular expression pattern to search for."),
    filePattern: z
      .string()
      .optional()
      .describe(
        "Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files.",
      ),
  }),
  outputSchema: z.object({
    matches: z
      .array(
        z.object({
          file: z.string().describe("The file where the match was found."),
          line: z.number().describe("The line number of the match."),
          context: z.string().describe("The surrounding context of the match."),
        }),
      )
      .describe("List of matches found in the search."),
    isTruncated: z
      .boolean()
      .describe(
        "Whether the content is truncated due to exceeding the maximum buffer length",
      ),
  }),
});
