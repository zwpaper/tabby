import { DiffView } from "@/integrations/editor/diff-view";
import { ensureFileDirectoryExists, getWorkspaceFolder } from "@/lib/fs";
import { getLogger } from "@/lib/logger";
import type { ClientToolsType } from "@ragdoll/tools";
import type {
  PreviewToolFunctionType,
  ToolFunctionType,
} from "@ragdoll/tools/src/types";
import * as vscode from "vscode";

const WindowToExpandForSearch = 15;
const logger = getLogger("applyDiffTool");

/**
 * Parse a diff and apply it to file content
 */
async function parseDiffAndApply(
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

  const startIndex = Math.max(startLine - 1 - WindowToExpandForSearch, 0);
  const endIndex = Math.min(endLine - 1 + 5, lines.length - 1);
  logger.trace(`Search range: ${startIndex} to ${endIndex}`);

  const extractedLines = lines.slice(startIndex, endIndex + 1);
  const searchLines = searchContent.split("\n");
  const startIndexInExtractedLines = fuzzyMatch(extractedLines, searchLines);
  logger.debug(`Fuzzy match result: ${startIndexInExtractedLines}`);

  if (startIndexInExtractedLines < 0) {
    throw new Error(
      "Search content does not match the original file content. Try to reread the file the latest content.",
    );
  }

  const updatedLines = [...lines];

  updatedLines.splice(
    startIndex + startIndexInExtractedLines,
    searchLines.length,
    ...replaceContent.split("\n"),
  );
  logger.trace("Created updated content");

  return updatedLines.join("\n");
}

/**
 * Find the exact match for search lines in extracted lines
 */
function fuzzyMatch(extractLines: string[], searchLines: string[]): number {
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
  if (content === suffixWithoutNewline) {
    return "";
  }
  throw new Error(
    `Diff format is incorrect. Expected '${suffixWithoutNewline}' suffix.`,
  );
}

/**
 * Preview the diff using DiffView
 */
export const previewApplyDiff: PreviewToolFunctionType<
  ClientToolsType["applyDiff"]
> = async (args, { toolCallId }) => {
  const { path, diff, startLine, endLine } = args || {};
  if (!args || !path || !diff || !startLine || !endLine) {
    return;
  }

  try {
    const workspaceFolder = getWorkspaceFolder();
    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, path);

    const fileBuffer = await vscode.workspace.fs.readFile(fileUri);
    const fileContent = fileBuffer.toString();

    const updatedContent = await parseDiffAndApply(
      diff,
      startLine,
      endLine,
      fileContent,
    );

    const diffView = await DiffView.getOrCreate(toolCallId, path);
    await diffView.update(updatedContent, true);

    logger.info(
      `Successfully previewed diff for ${path} with ID ${toolCallId}`,
    );
  } catch (error) {
    logger.error(`Failed to preview diff: ${error}`);
    throw new Error(
      `Failed to preview diff: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Apply a diff to a file using DiffView
 */
export const applyDiff: ToolFunctionType<ClientToolsType["applyDiff"]> = async (
  { path },
  { toolCallId },
) => {
  try {
    const workspaceFolder = getWorkspaceFolder();
    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, path);
    await ensureFileDirectoryExists(fileUri);

    const fileBuffer = await vscode.workspace.fs.readFile(fileUri);
    const fileContent = fileBuffer.toString();

    const diffView = DiffView.get(toolCallId);
    if (!diffView) {
      throw new Error("User has closed the diff view, cannot save changes.");
    }

    const edits = await diffView.saveChanges(path, fileContent);

    logger.info(`Successfully applied diff to ${path}`);
    return { success: true, ...edits };
  } catch (error) {
    logger.error(`Failed to apply diff: ${error}`);
    throw new Error(
      `Failed to apply diff: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
