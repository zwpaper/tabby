import { tool } from 'ai';
import { z } from "zod";

export const searchFiles = tool({
    description: "Request to perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.",
    parameters: z.object({
        path: z.string().describe("The path of the directory to search in (relative to the current working directory). This directory will be recursively searched."),
        regex: z.string().describe("The regular expression pattern to search for."),
        filePattern: z.string().optional().describe("Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files."),
    }),
});