import { z } from "zod";
import { EditFileOutputSchema, EditFileResultPrompt } from "./constants";
import { defineClientTool } from "./types";

export const multiApplyDiff = defineClientTool({
  description: `
Request to apply multiple replace operations to a single file using search and replace blocks.
This tool allows for batch replacements to files by specifying a list of operations, each with searchContent, replaceContent, startLine, and endLine.
The tool will maintain proper indentation and formatting while making changes.
Each searchContent section must exactly match existing content including whitespace and indentation.
If you're not confident in the exact content to search for, use the readFile tool first to get the exact content.
When applying the diffs, be extra careful to remember to change any closing brackets or other syntax that may be affected by the diff farther down in the file.
Only use this tool if there are multiple diffs to apply to the same file. Otherwise, use the applyDiff tool instead.

${EditFileResultPrompt}`.trim(),
  inputSchema: z.object({
    path: z
      .string()
      .describe(
        "The path of the file to modify (relative to the current working directory).",
      ),
    operations: z
      .array(
        z.object({
          searchContent: z.string().describe("The text to replace."),
          replaceContent: z.string().describe("The text to replace it with."),
          startLine: z
            .number()
            .describe("The line number where the search block starts."),
          endLine: z
            .number()
            .describe("The line number where the search block ends."),
        }),
      )
      .describe(
        "A list of search and replace operations to apply to the file.",
      ),
  }),
  outputSchema: EditFileOutputSchema, // Assuming similar output structure for now
});
