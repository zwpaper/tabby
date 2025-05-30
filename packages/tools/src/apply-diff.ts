import { z } from "zod";
import { EditFileOutputSchema, EditFileResultPrompt } from "./constants";
import { defineClientTool } from "./types";

export const applyDiff = defineClientTool({
  description: `
Request to replace existing code using a search and replace block.
This tool allows for precise, surgical replaces to files by specifying exactly what content to search for and what to replace it with.
The tool will maintain proper indentation and formatting while making changes.
Only a single operation is allowed per tool use.
The SEARCH section must exactly match existing content including whitespace and indentation.
If you're not confident in the exact content to search for, use the readFile tool first to get the exact content.
When applying the diffs, be extra careful to remember to change any closing brackets or other syntax that may be affected by the diff farther down in the file.
${EditFileResultPrompt}`.trim(),
  inputSchema: z.object({
    path: z
      .string()
      .describe(
        "The path of the file to modify (relative to the current working directory).",
      ),
    searchContent: z.string().describe("The text to replace."),
    replaceContent: z.string().describe("The text to replace it with."),
    startLine: z
      .number()
      .describe("The line number where the search block starts."),
    endLine: z
      .number()
      .describe("The line number where the search block ends."),
  }),
  outputSchema: EditFileOutputSchema,
});
