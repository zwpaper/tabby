import { DiffView } from "@/integrations/editor/diff-view";
import { ensureFileDirectoryExists, getWorkspaceFolder } from "@/lib/fs";
import { getLogger } from "@/lib/logger";
import { writeTextDocument } from "@/lib/write-text-document";
import type { ClientToolsType } from "@getpochi/tools";
import type {
  PreviewToolFunctionType,
  ToolFunctionType,
} from "@getpochi/tools";
import { processMultipleDiffs } from "@ragdoll/common/diff-utils";
import { validateTextFile } from "@ragdoll/common/node";
import * as vscode from "vscode";

const logger = getLogger("multiApplyDiffTool");

/**
 * Preview the diff using DiffView for multiple operations
 */
export const previewMultiApplyDiff: PreviewToolFunctionType<
  ClientToolsType["multiApplyDiff"]
> = async (args, { toolCallId, state, abortSignal }) => {
  const { path, edits } = args || {};
  if (!args || !path || !edits || edits.length === 0) {
    return;
  }

  const workspaceFolder = getWorkspaceFolder();
  const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, path);

  const fileBuffer = await vscode.workspace.fs.readFile(fileUri);
  await validateTextFile(fileBuffer);
  const fileContent = fileBuffer.toString();
  const updatedContent = await processMultipleDiffs(fileContent, edits);

  const diffView = await DiffView.getOrCreate(toolCallId, path);
  await diffView.update(updatedContent, state !== "partial-call", abortSignal);
};

/**
 * Apply multiple diff operations to a file using DiffView
 */
export const multiApplyDiff: ToolFunctionType<
  ClientToolsType["multiApplyDiff"]
> = async ({ path, edits }, { toolCallId, abortSignal, nonInteractive }) => {
  const workspaceFolder = getWorkspaceFolder();
  const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, path);
  await ensureFileDirectoryExists(fileUri);

  const fileBuffer = await vscode.workspace.fs.readFile(fileUri);
  await validateTextFile(fileBuffer);

  const fileContent = fileBuffer.toString();
  const updatedContent = await processMultipleDiffs(fileContent, edits);

  if (nonInteractive) {
    const edits = await writeTextDocument(path, updatedContent, abortSignal);
    logger.info(
      `Successfully applied multiple diff to ${path} in non-interactive mode`,
    );
    return { success: true, ...edits };
  }

  const diffView = await DiffView.getOrCreate(toolCallId, path);
  await diffView.update(updatedContent, true);
  const editsResult = await diffView.saveChanges(path, updatedContent);

  logger.info(`Successfully applied multiple diffs to ${path}`);
  return { success: true, ...editsResult };
};
