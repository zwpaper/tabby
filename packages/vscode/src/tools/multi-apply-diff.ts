import { DiffView } from "@/integrations/editor/diff-view";
import { parseDiffAndApplyV2 } from "@/lib/diff";
import { ensureFileDirectoryExists, getWorkspaceFolder } from "@/lib/fs";
import { getLogger } from "@/lib/logger";
import type { ClientToolsType } from "@ragdoll/tools";
import type { PreviewToolFunctionType, ToolFunctionType } from "@ragdoll/tools";
import { fileTypeFromBuffer } from "file-type";
import * as vscode from "vscode";

const logger = getLogger("multiApplyDiffTool");

/**
 * Preview the diff using DiffView for multiple operations
 */
export const previewMultiApplyDiff: PreviewToolFunctionType<
  ClientToolsType["multiApplyDiff"]
> = async (args, { toolCallId, state }) => {
  const { path, edits } = args || {};
  if (!args || !path || !edits || edits.length === 0) {
    return;
  }

  const workspaceFolder = getWorkspaceFolder();
  const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, path);

  const fileBuffer = await vscode.workspace.fs.readFile(fileUri);
  let updatedContent = fileBuffer.toString();

  // Apply edits sequentially
  for (const edit of edits) {
    updatedContent = await parseDiffAndApplyV2(
      updatedContent,
      edit.searchContent,
      edit.replaceContent,
      edit.expectedReplacements,
    );
  }

  const diffView = await DiffView.getOrCreate(toolCallId, path);
  await diffView.update(updatedContent, state !== "partial-call");
};

/**
 * Apply multiple diff operations to a file using DiffView
 */
export const multiApplyDiff: ToolFunctionType<
  ClientToolsType["multiApplyDiff"]
> = async ({ path, edits }, { toolCallId }) => {
  const workspaceFolder = getWorkspaceFolder();
  const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, path);
  await ensureFileDirectoryExists(fileUri);

  const fileBuffer = await vscode.workspace.fs.readFile(fileUri);
  let updatedContent = fileBuffer.toString();

  // Apply edits sequentially
  for (const edit of edits) {
    updatedContent = await parseDiffAndApplyV2(
      updatedContent,
      edit.searchContent,
      edit.replaceContent,
      edit.expectedReplacements,
    );
  }

  const type = await fileTypeFromBuffer(fileBuffer);

  if (type && !type.mime.startsWith("text/")) {
    throw new Error(
      `The file is binary or not plain text (detected type: ${type.mime}).`,
    );
  }

  const diffView = await DiffView.getOrCreate(toolCallId, path);
  await diffView.update(updatedContent, true);
  const editsResult = await diffView.saveChanges(path, updatedContent);

  logger.info(`Successfully applied multiple diffs to ${path}`);
  return { success: true, ...editsResult };
};
