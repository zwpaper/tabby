import * as path from "node:path";
import { fileTypeFromBuffer } from "file-type";

/**
 * File validation utilities
 */
export async function validateTextFile(fileBuffer: Uint8Array): Promise<void> {
  const type = await fileTypeFromBuffer(fileBuffer);
  if (type && !type.mime.startsWith("text/")) {
    throw new Error(
      `The file is binary or not plain text (detected type: ${type.mime}).`,
    );
  }
}

/**
 * Content processing utilities
 */
interface ContentProcessingOptions {
  startLine?: number;
  endLine?: number;
  addLineNumbers?: boolean;
  maxBytes?: number;
}

interface ProcessedContent {
  content: string;
  isTruncated: boolean;
}

export function selectFileContent(
  fileContent: string,
  options: ContentProcessingOptions = {},
): ProcessedContent {
  const {
    startLine,
    endLine,
    addLineNumbers = false,
    maxBytes = 1_048_576, // 1MB
  } = options;

  const lines = fileContent.split("\n");
  const start = startLine ? startLine - 1 : 0;
  const end = endLine ? endLine : lines.length;

  let selectedLines = lines.slice(start, end);

  if (addLineNumbers) {
    selectedLines = selectedLines.map(
      (line, index) => `${start + index + 1} | ${line}`,
    );
  }

  let content = selectedLines.join("\n");
  let isTruncated = false;

  if (Buffer.byteLength(content, "utf-8") > maxBytes) {
    content = content.slice(0, maxBytes);
    isTruncated = true;
  }

  return { content, isTruncated };
}

/**
 * Path validation utilities
 */
export function validateRelativePath(inputPath: string): void {
  if (path.isAbsolute(inputPath)) {
    throw new Error(
      `Absolute paths are not supported: ${inputPath}. Please use a relative path.`,
    );
  }
}
