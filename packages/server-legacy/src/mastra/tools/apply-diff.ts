import { createTool } from "@mastra/core"
import { z } from "zod"

export const applyDiff = createTool({
    id: "apply_diff",
    description: "Request to replace existing code using a search and replace block. This tool allows for precise, surgical replaces to files by specifying exactly what content to search for and what to replace it with.",
    inputSchema: z.object({
        path: z.string().describe("The path of the file to modify (relative to the current working directory)."),
        diff: z.string().describe("The search/replace block defining the changes."),
    }),
    outputSchema: z.object({
        success: z.boolean().describe("Indicates whether the diff was successfully applied."),
    }),
})