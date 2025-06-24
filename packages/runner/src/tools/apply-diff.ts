import * as fs from "node:fs/promises";
import * as nodePath from "node:path";
import { parseDiffAndApply } from "@ragdoll/common/diff-utils";
import { validateTextFile } from "@ragdoll/common/node";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { ensureFileDirectoryExists } from "../lib/fs";
import type { RunnerContext } from "../task-runner";

/**
 * Apply a diff to a file using DiffView
 */
export const applyDiff =
  (context: RunnerContext): ToolFunctionType<ClientToolsType["applyDiff"]> =>
  async ({ path, searchContent, replaceContent, expectedReplacements }) => {
    const fileUri = nodePath.join(context.cwd, path);
    await ensureFileDirectoryExists(fileUri);

    const fileBuffer = await fs.readFile(fileUri);
    await validateTextFile(fileBuffer);

    const fileContent = fileBuffer.toString();

    const updatedContent = await parseDiffAndApply(
      fileContent,
      searchContent,
      replaceContent,
      expectedReplacements,
    );

    await fs.writeFile(fileUri, updatedContent);
    return { success: true };
  };
