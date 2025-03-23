import { tool } from 'ai';
import { z } from "zod"

export const applyDiff = tool({
    description: "Request to replace existing code using a search and replace block. This tool allows for precise, surgical replaces to files by specifying exactly what content to search for and what to replace it with.",
    parameters: z.object({
        path: z.string().describe("The path of the file to modify (relative to the current working directory)."),
        diff: z.string().describe("The search/replace block defining the changes."),
    }),
})