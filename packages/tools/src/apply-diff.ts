import fs from "node:fs/promises";
import { z } from "zod";
import { defineClientTool } from "./types";

const WindowToExpandForSearch = 15;

export const { tool: applyDiff, execute: executeApplyDiff } = defineClientTool({
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
    \"\"\"Calculate total with 10% markup\"\"\"
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
  execute: async ({ path, diff, startLine, endLine }) => {
    const fileContent = await fs.readFile(path, "utf-8");
    let updatedContent = fileContent;

    const diffBlocks = diff.trim().split("\n=======\n");
    if (diffBlocks.length !== 2) {
      throw new Error("Invalid diff format");
    }
    const searchContent = removeSearchPrefix(diffBlocks[0]);
    const replaceContent = removeReplaceSuffix(diffBlocks[1]);

    const lines = fileContent.split("\n");
    const startIndex = Math.max(startLine - 1 - WindowToExpandForSearch, 0);
    const endIndex = Math.min(endLine - 1 + 5, lines.length - 1);

    const extractedLines = lines.slice(startIndex, endIndex + 1);
    const searchLines = searchContent.split("\n");
    const startIndexInExtractedLines = fuzzyMatch(extractedLines, searchLines);

    if (startIndexInExtractedLines >= 0) {
      lines.splice(
        startIndex + startIndexInExtractedLines,
        searchLines.length,
        ...replaceContent.split("\n"),
      );
      updatedContent = lines.join("\n");
    } else {
      throw new Error(
        "Search content does not match the original file content.",
      );
    }

    await fs.writeFile(path, updatedContent, "utf-8");
    return { success: true };
  },
});

// Extract lines, a slightly larger range than the search lines, to ensure we can find the exact match.
// Return start_index for the extracted lines (or undefined if not found).
function fuzzyMatch(extractLines: string[], searchLines: string[]) {
  const firstLineMatches = extractLines
    .map((line, index) => (line.trim() === searchLines[0].trim() ? index : -1))
    .filter((index) => index !== -1);
  for (const startIndex of firstLineMatches) {
    if (
      extractLines
        .slice(startIndex, startIndex + searchLines.length)
        .every((line, index) => line.trim() === searchLines[index].trim())
    ) {
      return startIndex;
    }
  }
  return -1;
}

function removeSearchPrefix(content: string) {
  const prefix = "<<<<<<< SEARCH\n";
  if (content.startsWith(prefix)) {
    return content.slice(prefix.length);
  }
  throw new Error(
    `Diff formatis incorrect. Expected '${prefix.trim()}' prefix.`,
  );
}

function removeReplaceSuffix(content: string) {
  const suffixWithNewline = "\n>>>>>>> REPLACE";
  const suffixWithoutNewline = ">>>>>>> REPLACE"; // Handle empty replace case

  if (content.endsWith(suffixWithNewline)) {
    return content.slice(0, -suffixWithNewline.length);
  }
  if (content === suffixWithoutNewline) {
    // If the content is exactly the suffix (empty replace), return empty string
    return "";
  }
  throw new Error(
    `Diff format is incorrect. Expected '${suffixWithoutNewline}' suffix.`,
  );
}
