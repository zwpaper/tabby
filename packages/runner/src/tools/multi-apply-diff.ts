import * as fs from "node:fs/promises";
import * as nodePath from "node:path";
import type { ClientToolsV5Type, ToolFunctionTypeV5 } from "@getpochi/tools";
import { processMultipleDiffs } from "@ragdoll/common/diff-utils";
import { validateTextFile } from "@ragdoll/common/node";
import { ensureFileDirectoryExists } from "../lib/fs";
import type { ToolCallOptions } from "../types";

/**
 * Apply multiple diff operations to a file using DiffView
 */
export const multiApplyDiff =
  (
    context: ToolCallOptions,
  ): ToolFunctionTypeV5<ClientToolsV5Type["multiApplyDiff"]> =>
  async ({ path, edits }) => {
    const fileUri = nodePath.join(context.cwd, path);
    await ensureFileDirectoryExists(fileUri);

    const fileBuffer = await fs.readFile(fileUri);
    await validateTextFile(fileBuffer);

    const fileContent = fileBuffer.toString();
    const updatedContent = await processMultipleDiffs(fileContent, edits);
    await fs.writeFile(fileUri, updatedContent);

    return { success: true };
  };
