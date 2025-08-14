import { z } from "zod";
import { defineClientToolV5 } from "./types";

const toolDef = {
  description: `
- Fast content search tool that works with any codebase size
- Searches file contents using regular expressions
- Supports Rust regex syntax (eg. "log.*Error", "function\s+\w+", etc.)
- Filter files by pattern with the include parameter (eg. "*.js", "*.{ts,tsx}")
- Returns file paths with at least one match sorted by modification time
- Use this tool when you need to find files containing specific patterns
`.trim(),
  inputSchema: z.object({
    path: z
      .string()
      .describe(
        "The path of the directory to search in (relative to the current working directory).",
      ),
    regex: z
      .string()
      .describe(
        "The regular expression pattern to search for in file contents. Uses Rust regex syntax.",
      ),
    filePattern: z
      .string()
      .optional()
      .describe(
        'File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}"). If not provided, it will search all files.',
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
};

export const searchFiles = defineClientToolV5(toolDef);
