import fs from "node:fs/promises";
import type { ApplyDiffFunctionType } from "@ragdoll/tools";

const WindowToExpandForSearch = 5;

export const applyDiff: ApplyDiffFunctionType = async ({
  path,
  diff,
  startLine,
  endLine,
}) => {
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
    throw new Error("Search content does not match the original file content.");
  }

  await fs.writeFile(path, updatedContent, "utf-8");
  return { success: true };
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
  const suffix = "\n>>>>>>> REPLACE";
  if (content.endsWith(suffix)) {
    return content.slice(0, -suffix.length);
  }
  throw new Error(
    `Diff format is incorrect. Expected '${suffix.trim()}' suffix.`,
  );
}
