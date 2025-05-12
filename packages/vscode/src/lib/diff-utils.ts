import { getLogger } from "@/lib/logger";

const WindowToExpandForSearch = 15;
const logger = getLogger("diffUtils");

/**
 * Parse a diff and apply it to file content
 */
export async function parseDiffAndApply(
  diff: string,
  startLine: number,
  endLine: number,
  fileContent: string,
): Promise<string> {
  const lines = fileContent.split("\n");
  logger.trace(`Read file with ${lines.length} lines`);

  const diffBlocks = diff.trim().split("\n=======\n");
  if (diffBlocks.length !== 2) {
    throw new Error("Invalid diff format");
  }
  logger.trace("Parsed diff blocks");

  const searchContent = removeSearchPrefix(diffBlocks[0]);
  const replaceContent = removeReplaceSuffix(diffBlocks[1]);
  logger.trace("Extracted search and replace content");

  // Adjust search window based on start/endLine and WindowToExpandForSearch
  // Note: startLine/endLine are 1-based, array indices are 0-based.
  const searchWindowStartIndex = Math.max(
    startLine - 1 - WindowToExpandForSearch,
    0,
  );
  // The end index for slice needs to be one *after* the last desired line.
  // We add WindowToExpandForSearch to endLine (which is 1-based)
  const searchWindowEndIndex = Math.min(
    endLine + WindowToExpandForSearch,
    lines.length,
  );
  logger.trace(
    `Search window range (0-based lines): ${searchWindowStartIndex} to ${searchWindowEndIndex - 1}`,
  );

  const extractedLines = lines.slice(
    searchWindowStartIndex,
    searchWindowEndIndex,
  );
  const searchLines = searchContent.split("\n");

  // Find the start index of the match *within the extracted window*
  const startIndexInExtractedLines = fuzzyMatch(extractedLines, searchLines);
  logger.debug(
    `Fuzzy match result (index within window): ${startIndexInExtractedLines}`,
  );

  if (startIndexInExtractedLines < 0) {
    throw new Error(
      "Search content does not match the original file content within the search window. Try to reread the file for the latest content.",
    );
  }

  // Calculate the actual start index in the original full 'lines' array
  const actualStartIndex = searchWindowStartIndex + startIndexInExtractedLines;
  logger.trace(`Actual start index in full file: ${actualStartIndex}`);

  const updatedLines = [...lines];

  const replacementLines = replaceContent ? replaceContent.split("\n") : [];
  updatedLines.splice(
    actualStartIndex,
    searchLines.length,
    ...replacementLines,
  );
  logger.trace("Created updated content");

  return updatedLines.join("\n");
}

/**
 * Find the exact match for search lines in extracted lines, ignoring leading/trailing whitespace.
 * Returns the starting index within extractLines if found, otherwise -1.
 */
function fuzzyMatch(extractLines: string[], searchLines: string[]): number {
  if (searchLines.length === 0) {
    return -1; // Cannot match an empty search
  }
  if (searchLines.length > extractLines.length) {
    return -1; // Cannot match if search is longer than extracted text
  }

  const trimmedFirstSearchLine = searchLines[0].trim();

  for (let i = 0; i <= extractLines.length - searchLines.length; i++) {
    // Check if the first line matches (trimmed)
    if (extractLines[i].trim() === trimmedFirstSearchLine) {
      let fullMatch = true;
      // Check subsequent lines
      for (let j = 1; j < searchLines.length; j++) {
        if (extractLines[i + j].trim() !== searchLines[j].trim()) {
          fullMatch = false;
          break;
        }
      }
      if (fullMatch) {
        return i; // Found the start index of the match
      }
    }
  }

  return -1; // No match found
}

/**
 * Remove the search prefix from the diff content
 */
function removeSearchPrefix(content: string): string {
  const prefix = "<<<<<<< SEARCH\n";
  if (content.startsWith(prefix)) {
    return content.slice(prefix.length);
  }
  throw new Error(
    `Diff format is incorrect. Expected '${prefix.trim()}' prefix.`,
  );
}

/**
 * Remove the replace suffix from the diff content
 */
function removeReplaceSuffix(content: string): string {
  const suffixWithNewline = "\n>>>>>>> REPLACE";
  const suffixWithoutNewline = ">>>>>>> REPLACE";

  if (content.endsWith(suffixWithNewline)) {
    return content.slice(0, -suffixWithNewline.length);
  }
  // Handle case where replace content is empty
  if (content === suffixWithoutNewline) {
    return "";
  }
  throw new Error(
    `Diff format is incorrect. Expected '${suffixWithoutNewline}' suffix.`,
  );
}
