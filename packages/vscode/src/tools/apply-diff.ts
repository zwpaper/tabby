import { DiffView } from "@/integrations/editor/diff-view";
import { ensureFileDirectoryExists, getWorkspaceFolder } from "@/lib/fs";
import { getLogger } from "@/lib/logger";
import { parseDiffAndApplyV2 } from "@ragdoll/common/diff-utils";
import { validateTextFile } from "@ragdoll/common/node";
import type { ClientToolsType } from "@ragdoll/tools";
import type { PreviewToolFunctionType, ToolFunctionType } from "@ragdoll/tools";
import * as vscode from "vscode";

const logger = getLogger("applyDiffTool");

/**
 * Preview the diff using DiffView
 */
export const previewApplyDiff: PreviewToolFunctionType<
  ClientToolsType["applyDiff"]
> = async (args, { toolCallId, state }) => {
  const { path, searchContent, replaceContent, expectedReplacements } =
    args || {};
  if (
    !args ||
    !path ||
    searchContent === undefined ||
    replaceContent === undefined
  ) {
    return;
  }

  const workspaceFolder = getWorkspaceFolder();
  const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, path);

  const fileBuffer = await vscode.workspace.fs.readFile(fileUri);
  await validateTextFile(fileBuffer);

  const fileContent = fileBuffer.toString();

  const updatedContent = await parseDiffAndApplyV2(
    fileContent,
    searchContent,
    replaceContent,
    expectedReplacements,
  );

  const diffView = await DiffView.getOrCreate(toolCallId, path);
  await diffView.update(updatedContent, state !== "partial-call");
};

/**
 * Apply a diff to a file using DiffView
 */
export const applyDiff: ToolFunctionType<ClientToolsType["applyDiff"]> = async (
  { path, searchContent, replaceContent, expectedReplacements },
  { toolCallId },
) => {
  const workspaceFolder = getWorkspaceFolder();
  const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, path);
  await ensureFileDirectoryExists(fileUri);

  const fileBuffer = await vscode.workspace.fs.readFile(fileUri);
  await validateTextFile(fileBuffer);

  const fileContent = fileBuffer.toString();

  const updatedContent = await parseDiffAndApplyV2(
    fileContent,
    searchContent,
    replaceContent,
    expectedReplacements,
  );

  const diffView = await DiffView.getOrCreate(toolCallId, path);
  await diffView.update(updatedContent, true);
  const edits = await diffView.saveChanges(path, updatedContent);

  logger.info(`Successfully applied diff to ${path}`);
  return { success: true, ...edits };
};
