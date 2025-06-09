import { getLogger } from "./logger";

const logger = getLogger("diffUtils");

function normalize(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "");
}

export class DiffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiffError";
  }
}

/**
 * Parse a diff and apply it to file content (new version matching tools definition)
 */
export async function parseDiffAndApply(
  fileContent: string,
  searchContent: string,
  replaceContent: string,
  expectedReplacements = 1,
): Promise<string> {
  logger.trace(
    `Applying diff with expectedReplacements: ${expectedReplacements}`,
  );

  const isCRLF = fileContent.includes("\r\n");

  const normalizedFileContent = normalize(fileContent);
  const normalizedSearchContent = normalize(searchContent);

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
  const occurrences = countOccurrences(
    normalizedFileContent,
    normalizedSearchContent,
  );
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
  const result = normalizedFileContent.replaceAll(
    normalizedSearchContent,
    replaceContent,
  );
  logger.trace("Successfully applied diff");

  if (isCRLF) {
    return result.replace(/\n/g, "\r\n");
  }

  return result;
}

/**
 * Process multiple diff operations sequentially
 */
export async function processMultipleDiffs(
  fileContent: string,
  edits: Array<{
    searchContent: string;
    replaceContent: string;
    expectedReplacements?: number;
  }>,
): Promise<string> {
  let updatedContent = fileContent;

  for (const edit of edits) {
    updatedContent = await parseDiffAndApply(
      updatedContent,
      edit.searchContent,
      edit.replaceContent,
      edit.expectedReplacements,
    );
  }

  return updatedContent;
}

/**
 * Count occurrences of searchContent in text
 */
function countOccurrences(text: string, searchContent: string): number {
  if (searchContent === "") return 0;

  const normalizedText = normalize(text);
  const normalizedSearchContent = normalize(searchContent);

  let count = 0;
  let position = 0;

  while (true) {
    position = normalizedText.indexOf(normalizedSearchContent, position);
    if (position === -1) break;
    count++;
    position += normalizedSearchContent.length;
  }

  return count;
}
