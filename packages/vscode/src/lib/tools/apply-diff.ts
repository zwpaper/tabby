import * as nodePath from "node:path";
import type { ClientToolsType } from "@ragdoll/tools";
import type {
  PreviewToolFunctionType,
  ToolFunctionType,
} from "@ragdoll/tools/src/types";
import * as vscode from "vscode";
import {
  ensureDirectoryExists,
  getWorkspaceFolder,
  tempfile,
  writeFile,
} from "../file-utils";
import { getLogger } from "../logger";
import { closePreviewTabs, findPreviewTabs } from "../tab-utils";

const WindowToExpandForSearch = 15;
const logger = getLogger("applyDiffTool");

/**
 * Manages the preview document for diff views
 */
async function upsertDiffPreviewData(
  toolCallId: string,
  path: string,
  content: string,
): Promise<vscode.TextDocument> {
  const extension = `${toolCallId}${nodePath.extname(path)}`;
  logger.trace(`Looking for document with extension: ${extension}`);

  let previewTextDocument = vscode.workspace.textDocuments.find((doc) =>
    doc.uri.fsPath.endsWith(extension),
  );

  if (!previewTextDocument) {
    logger.debug("No existing document found, creating new one");
    const tmpfile = tempfile({ extension });
    const fileUri = vscode.Uri.file(tmpfile);
    await writeFile(fileUri, content);
    previewTextDocument = await vscode.workspace.openTextDocument(fileUri);
    logger.debug(
      `Created new preview document: ${previewTextDocument.uri.fsPath}`,
    );
  } else {
    await writeFile(previewTextDocument.uri, content);
    logger.debug(
      `Updated content for document: ${previewTextDocument.uri.fsPath}`,
    );
  }

  return previewTextDocument;
}

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
 * Preview the diff without applying it
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

    const textDocument = await upsertDiffPreviewData(
      toolCallId,
      path,
      updatedContent,
    );

    const isActive = findPreviewTabs(toolCallId, "(Diff Preview)").length > 0;

    const diffEditorExists = vscode.window.visibleTextEditors.some((editor) => {
      if (editor.document.uri.scheme === "diff") {
        const diffUri = editor.document.uri.toString();
        return (
          diffUri.includes(path) && diffUri.includes(textDocument.uri.fsPath)
        );
      }
      return false;
    });

    if (!isActive) {
      if (diffEditorExists) {
        await vscode.window.showTextDocument(textDocument);
      } else {
        logger.debug("Showing diff view");
        await vscode.commands.executeCommand(
          "vscode.diff",
          fileUri,
          textDocument.uri,
          `${path} (Diff Preview)`,
          {
            preview: false,
          },
        );
      }
      logger.info(
        `Successfully previewed diff for ${path} with ID ${toolCallId}`,
      );
    }
  } catch (error) {
    logger.error(`Failed to preview diff: ${error}`);
    throw new Error(
      `Failed to preview diff: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Apply a diff to a file without showing a diff view
 */
export const applyDiff: ToolFunctionType<ClientToolsType["applyDiff"]> = async (
  { path, diff, startLine, endLine },
  { toolCallId },
) => {
  try {
    const workspaceFolder = getWorkspaceFolder();
    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, path);

    const dirUri = vscode.Uri.joinPath(fileUri, "..");
    await ensureDirectoryExists(dirUri);

    const fileBuffer = await vscode.workspace.fs.readFile(fileUri);
    const fileContent = fileBuffer.toString();

    const updatedContent = await parseDiffAndApply(
      diff,
      startLine,
      endLine,
      fileContent,
    );

    await writeFile(fileUri, updatedContent);

    const previewTabs = findPreviewTabs(toolCallId, "(Diff Preview)");
    await closePreviewTabs(previewTabs);

    const document = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(document, { preview: false });

    logger.info(`Successfully applied diff to ${path}`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to apply diff: ${error}`);
    throw new Error(
      `Failed to apply diff: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
