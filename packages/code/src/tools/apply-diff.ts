import fs from "node:fs/promises";
import type { ApplyDiffFunctionType } from "@ragdoll/tools";

const WindowToExpandForSearch = 200;

export const applyDiff: ApplyDiffFunctionType = async ({ path, diff }) => {
  const fileContent = await fs.readFile(path, "utf-8");
  const diffBlocks = diff.split("<<<<<<< SEARCH");
  let updatedContent = fileContent;

  for (let i = 1; i < diffBlocks.length; i++) {
    const block = diffBlocks[i];
    const [metadata, rest] = block.split("-------\n");
    const [searchContent, replaceContent] = rest.split("\n=======\n");
    const endReplace = replaceContent.split("\n>>>>>>> REPLACE")[0];

    const startLine = Number.parseInt(
      metadata.split(":start_line:")[1].split(":")[0].trim(),
    );
    const endLine = Number.parseInt(
      metadata.split(":end_line:")[1].split(":")[0].trim(),
    );

    const lines = updatedContent.split("\n");
    const startIndex = Math.max(startLine - 1 - WindowToExpandForSearch, 0);
    const endIndex = Math.min(endLine - 1 + 5, lines.length - 1);

    const extractedLines = lines.slice(startIndex, endIndex + 1);
    const searchLines = searchContent.split("\n");
    const startIndexInExtractedLines = fuzzyMatch(extractedLines, searchLines);

    if (startIndexInExtractedLines >= 0) {
      lines.splice(
        startIndex + startIndexInExtractedLines,
        searchLines.length,
        ...endReplace.split("\n"),
      );
      updatedContent = lines.join("\n");
    } else {
      throw new Error(
        `Search content does not match the original file content.\nOriginal content:\n${extractedLines}\nSearch content:\n${searchLines}\n`,
      );
    }
  }

  await fs.writeFile(path, updatedContent, "utf-8");
  return true;
};

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
