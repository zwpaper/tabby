import { z } from "zod";
import { type ToolFunctionType, declareClientTool } from "./types";

export const applyDiff = declareClientTool({
  description: `Request to replace existing code using a search and replace block.
This tool allows for precise, surgical replaces to files by specifying exactly what content to search for and what to replace it with.
The tool will maintain proper indentation and formatting while making changes.
Only a single operation is allowed per tool use.
The SEARCH section must exactly match existing content including whitespace and indentation.
If you're not confident in the exact content to search for, use the readFile tool first to get the exact content.
When applying the diffs, be extra careful to remember to change any closing brackets or other syntax that may be affected by the diff farther down in the file.

Parameters:
- path: (required) The path of the file to modify (relative to the current working directory)
- diff: (required) The search/replace block defining the changes.
- start_line: (required) The line number where the search block starts.
- end_line: (required) The line number where the search block ends.

Diff format:
\`\`\`
<<<<<<< SEARCH
[exact content to find including whitespace]
=======
[new content to replace with]
>>>>>>> REPLACE
\`\`\`

Example:

Original file:
\`\`\`
1 | def calculate_total(items):
2 |     total = 0
3 |     for item in items:
4 |         total += item
5 |     return total
\`\`\`

Search/Replace content:
\`\`\`
<<<<<<< SEARCH
def calculate_total(items):
    total = 0
    for item in items:
        total += item
    return total
=======
def calculate_total(items):
    """Calculate total with 10% markup"""
    return sum(item * 1.1 for item in items)
>>>>>>> REPLACE
\`\`\`
`,
  inputSchema: z.object({
    path: z
      .string()
      .describe(
        "The path of the file to modify (relative to the current working directory).",
      ),
    diff: z.string().describe("The search/replace block defining the changes."),
    startLine: z
      .number()
      .describe("The line number where the search block starts."),
    endLine: z
      .number()
      .describe("The line number where the search block ends."),
  }),
  outputSchema: z.object({
    success: z
      .boolean()
      .describe("Indicates whether the operation was successful."),
  }),
});

export type ApplyDiffFunctionType = ToolFunctionType<typeof applyDiff>;
