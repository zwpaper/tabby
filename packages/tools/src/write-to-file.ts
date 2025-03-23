import { z } from "zod";
import { defineClientTool, ToolFunctionType } from './types';

export const writeToFile = defineClientTool({
    description: "Request to write full content to a file at the specified path. If the file exists, it will be overwritten with the provided content. If the file doesn't exist, it will be created. This tool will automatically create any directories needed to write the file.",
    inputSchema: z.object({
        path: z.string().describe("The path of the file to write to (relative to the current working directory)."),
        content: z.string().describe("The content to write to the file."),
        lineCount: z.number().describe("The number of lines in the file, including empty lines."),
    }),
    outputSchema: z.object({
        success: z.boolean().describe("Indicates whether the file was written successfully."),
    }),
});

export type WriteToFileFunctionType = ToolFunctionType<typeof writeToFile>;