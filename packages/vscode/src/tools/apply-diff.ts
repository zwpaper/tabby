import { DiffView } from "@/integrations/editor/diff-view";
import { parseDiffAndApply } from "@/lib/diff"; // Import the extracted function
import { ensureFileDirectoryExists, getWorkspaceFolder } from "@/lib/fs";
import { getLogger } from "@/lib/logger";
import { fixCodeGenerationOutput } from "@/tools/output-utils";
import type { ClientToolsType } from "@ragdoll/tools";
import type {
  PreviewToolFunctionType,
  ToolFunctionType,
} from "@ragdoll/tools/src/types";
import { fileTypeFromBuffer } from "file-type";
import * as vscode from "vscode";

const logger = getLogger("applyDiffTool");

/**
 * Preview the diff using DiffView
 */
export const previewApplyDiff: PreviewToolFunctionType<
  ClientToolsType["applyDiff"]
> = async (args, { toolCallId, state }) => {
  const { path, diff, startLine, endLine } = args || {};
  if (!args || !path || !diff || !startLine || !endLine) {
    return;
  }

  const processedDiff = fixCodeGenerationOutput(diff);

  const workspaceFolder = getWorkspaceFolder();
  const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, path);

  const fileBuffer = await vscode.workspace.fs.readFile(fileUri);
  const fileContent = fileBuffer.toString();

  const updatedContent = await parseDiffAndApply(
    processedDiff,
    startLine,
    endLine,
    fileContent,
  );

  const diffView = await DiffView.getOrCreate(toolCallId, path);
  await diffView.update(updatedContent, state !== "partial-call");
};

/**
 * Apply a diff to a file using DiffView
 */
export const applyDiff: ToolFunctionType<ClientToolsType["applyDiff"]> = async (
  { path, diff, startLine, endLine },
  { toolCallId },
) => {
  const processedDiff = fixCodeGenerationOutput(diff);

  const workspaceFolder = getWorkspaceFolder();
  const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, path);
  await ensureFileDirectoryExists(fileUri);

  const fileBuffer = await vscode.workspace.fs.readFile(fileUri);
  const fileContent = fileBuffer.toString();

  const updatedContent = await parseDiffAndApply(
    processedDiff,
    startLine,
    endLine,
    fileContent,
  );

  const type = await fileTypeFromBuffer(fileBuffer);

  if (type && !type.mime.startsWith("text/")) {
    throw new Error(
      `The file is binary or not plain text (detected type: ${type.mime}).`,
    );
  }

  const diffView = await DiffView.getOrCreate(toolCallId, path);
  await diffView.update(updatedContent, true);
  const edits = await diffView.saveChanges(path, updatedContent);

  logger.info(`Successfully applied diff to ${path}`);
  return { success: true, ...edits };
};
