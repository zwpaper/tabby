import path from "node:path";
import { glob } from "glob";
import { z } from "zod";
import { defineClientTool } from "./types";

// Define a limit for the number of files returned
const MAX_FILES = 300;

export const { tool: globFiles, execute: executeGlobFiles } = defineClientTool({
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
  execute: async ({ path: searchPath, globPattern }) => {
    // Ensure the search path is treated as a directory
    const absoluteSearchPath = path.resolve(searchPath);

    // Use glob to find files matching the pattern within the specified directory
    // The `cwd` option ensures the pattern is matched relative to the search path
    // `nodir: true` ensures only files are returned, not directories
    let files = await glob(globPattern, {
      cwd: absoluteSearchPath,
      nodir: true,
      absolute: false, // Keep paths relative to cwd
    });

    let isTruncated = false;
    if (files.length > MAX_FILES) {
      files = files.slice(0, MAX_FILES);
      isTruncated = true;
    }

    // Return the list of relative file paths and the truncation status
    return { files, isTruncated };
  },
});
