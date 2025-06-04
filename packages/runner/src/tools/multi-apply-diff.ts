import * as fs from "node:fs/promises";
import * as nodePath from "node:path";
import { getLogger } from "@ragdoll/common";
import { processMultipleDiffs } from "@ragdoll/common/diff-utils";
import { validateTextFile } from "@ragdoll/common/node";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
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
  await validateTextFile(fileBuffer);

  const fileContent = fileBuffer.toString();
  const updatedContent = await processMultipleDiffs(fileContent, edits);

  await fs.writeFile(fileUri, updatedContent);

  logger.info(`Successfully applied multiple diffs to ${fileUri}`);
  return { success: true };
};
