import { getLogger } from "@/lib/logger";

const WindowToExpandForSearch = 15;
const logger = getLogger("diffUtils");

export class DiffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiffError";
  }
}

/**
 * Parse a diff and apply it to file content (legacy version for multi-apply-diff)
 */
export async function parseDiffAndApply(
  fileContent: string,
  startLine: number,
  endLine: number,
  searchContent: string,
  replaceContent: string,
): Promise<string> {
  const lines = fileContent.split("\n");
  logger.trace(`Read file with ${lines.length} lines`);

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
    throw new DiffError(
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
 * Parse a diff and apply it to file content (new version matching tools definition)
 */
export async function parseDiffAndApplyV2(
  fileContent: string,
  searchContent: string,
  replaceContent: string,
  expectedReplacements = 1,
): Promise<string> {
  logger.trace(
    `Applying diff with expectedReplacements: ${expectedReplacements}`,
  );

  if (searchContent === replaceContent) {
    throw new DiffError(
      "Search content and replace content cannot be the same",
    );
  }

  // Handle empty search content (for creating new files)
  if (searchContent === "") {
    if (fileContent === "") {
      return replaceContent;
    }
    throw new DiffError("Cannot use empty search content on non-empty file");
  }

  // Count occurrences of searchContent in fileContent
  const occurrences = countOccurrences(fileContent, searchContent);
  logger.trace(`Found ${occurrences} occurrences of search content`);

  if (occurrences === 0) {
    throw new DiffError(
      "Search content does not match the file content. Try to reread the file for the latest content.",
    );
  }

  if (occurrences !== expectedReplacements) {
    throw new DiffError(
      `Expected ${expectedReplacements} occurrences but found ${occurrences}. Please verify the search content and expectedReplacements parameter.`,
    );
  }

  // Replace all occurrences
  const result = fileContent.replaceAll(searchContent, replaceContent);
  logger.trace("Successfully applied diff");

  return result;
}

/**
 * Count occurrences of searchContent in text
 */
function countOccurrences(text: string, searchContent: string): number {
  if (searchContent === "") return 0;

  let count = 0;
  let position = 0;

  while (true) {
    position = text.indexOf(searchContent, position);
    if (position === -1) break;
    count++;
    position += searchContent.length;
  }

  return count;
}
