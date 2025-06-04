import * as fs from "node:fs/promises";
import * as nodePath from "node:path";
import { getLogger } from "@ragdoll/common";
import { parseDiffAndApplyV2 } from "@ragdoll/common/diff-utils";
import { validateTextFile } from "@ragdoll/common/node";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { ensureFileDirectoryExists, getWorkspacePath } from "../lib/fs";

const logger = getLogger("applyDiffTool");

/**
 * Apply a diff to a file using DiffView
 */
export const applyDiff: ToolFunctionType<
  ClientToolsType["applyDiff"]
> = async ({ path, searchContent, replaceContent, expectedReplacements }) => {
  const workspaceFolder = getWorkspacePath();
  const fileUri = nodePath.join(workspaceFolder, path);
  await ensureFileDirectoryExists(fileUri);

  const fileBuffer = await fs.readFile(fileUri);
  await validateTextFile(fileBuffer);

  const fileContent = fileBuffer.toString();

  const updatedContent = await parseDiffAndApplyV2(
    fileContent,
    searchContent,
    replaceContent,
    expectedReplacements,
  );

  await fs.writeFile(fileUri, updatedContent);

  logger.info(`Successfully applied diff to ${fileUri}`);
  return { success: true };
};
