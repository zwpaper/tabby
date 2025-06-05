import * as fs from "node:fs/promises";
import * as nodePath from "node:path";
import { processMultipleDiffs } from "@ragdoll/common/diff-utils";
import { validateTextFile } from "@ragdoll/common/node";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { ensureFileDirectoryExists } from "../lib/fs";
import type { RunnerContext } from "../task-runner";

/**
 * Apply multiple diff operations to a file using DiffView
 */
export const multiApplyDiff =
  (
    context: RunnerContext,
  ): ToolFunctionType<ClientToolsType["multiApplyDiff"]> =>
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
