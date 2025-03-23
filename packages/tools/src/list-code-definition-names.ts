import { z } from "zod";
import { defineClientTool, ToolFunctionType } from './types';

export const listCodeDefinitionNames = defineClientTool({
    description: "Request to list definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This tool provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.",
    inputSchema: z.object({
        path: z.string().describe("The path of the directory (relative to the current working directory) to list top-level source code definitions for."),
    }),
    outputSchema: z.object({
        definitions: z.array(z.string()).describe("List of top-level source code definitions."),
    }),
});

export type ListCodeDefinitionNamesFunctionType = ToolFunctionType<typeof listCodeDefinitionNames>;