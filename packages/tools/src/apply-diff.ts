import { z } from "zod";
import { defineClientTool, ToolFunctionType } from './types';

export const applyDiff = defineClientTool({
    description: "Request to replace existing code using a search and replace block. This tool allows for precise, surgical replaces to files by specifying exactly what content to search for and what to replace it with.",
    inputSchema: z.object({
        path: z.string().describe("The path of the file to modify (relative to the current working directory)."),
        diff: z.string().describe("The search/replace block defining the changes."),
    }),
    outputSchema: z.object({
        success: z.boolean().describe("Indicates whether the operation was successful."),
        message: z.string().optional().describe("Optional message providing additional details about the operation."),
    }),
});

export type ApplyDiffFunctionType = ToolFunctionType<typeof applyDiff>;