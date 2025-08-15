import * as fs from "node:fs/promises";
import * as nodePath from "node:path";
import type { ClientToolsType, ToolFunctionType } from "@getpochi/tools";
import { processMultipleDiffs } from "@ragdoll/common/diff-utils";
import { validateTextFile } from "@ragdoll/common/tool-utils";
import { ensureFileDirectoryExists } from "../lib/fs";
import type { ToolCallOptions } from "../types";

/**
 * Apply multiple diff operations to a file using DiffView
 */
export const multiApplyDiff =
  (
    context: ToolCallOptions,
  ): ToolFunctionType<ClientToolsType["multiApplyDiff"]> =>
  async ({ path, edits }) => {
    const fileUri = nodePath.join(context.cwd, path);
    await ensureFileDirectoryExists(fileUri);

    await validateTextFile(fileUri);
    const fileContent = (await fs.readFile(fileUri)).toString();

    const updatedContent = await processMultipleDiffs(fileContent, edits);
    await fs.writeFile(fileUri, updatedContent);

    return { success: true };
  };
