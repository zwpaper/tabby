import * as fs from "node:fs/promises";
import * as nodePath from "node:path";
import { getLogger } from "@ragdoll/common";
import { parseDiffAndApplyV2 } from "@ragdoll/common/diff-utils";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { fileTypeFromBuffer } from "file-type";
import { ensureFileDirectoryExists, getWorkspacePath } from "../lib/fs";

const logger = getLogger("multiApplyDiffTool");

/**
 * Apply multiple diff operations to a file using DiffView
 */
export const multiApplyDiff: ToolFunctionType<
  ClientToolsType["multiApplyDiff"]
> = async ({ path, edits }) => {
  const workspaceFolder = getWorkspacePath();
  const fileUri = nodePath.join(workspaceFolder, path);
  await ensureFileDirectoryExists(fileUri);

  const fileBuffer = await fs.readFile(fileUri);
  let updatedContent = fileBuffer.toString();

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

  await fs.writeFile(fileUri, updatedContent);

  logger.info(`Successfully applied multiple diffs to ${fileUri}`);
  return { success: true };
};
