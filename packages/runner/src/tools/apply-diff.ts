import * as fs from "node:fs/promises";
import * as nodePath from "node:path";
import type { ClientToolsType, ToolFunctionType } from "@getpochi/tools";
import { parseDiffAndApply } from "@ragdoll/common/diff-utils";
import { validateTextFile } from "@ragdoll/common/node";
import { ensureFileDirectoryExists } from "../lib/fs";
import type { ToolCallOptions } from "../types";

/**
 * Apply a diff to a file using DiffView
 */
export const applyDiff =
  (context: ToolCallOptions): ToolFunctionType<ClientToolsType["applyDiff"]> =>
  async ({ path, searchContent, replaceContent, expectedReplacements }) => {
    const fileUri = nodePath.join(context.cwd, path);
    await ensureFileDirectoryExists(fileUri);

    await validateTextFile(fileUri);
    const fileContent = (await fs.readFile(fileUri)).toString();

    const updatedContent = await parseDiffAndApply(
      fileContent,
      searchContent,
      replaceContent,
      expectedReplacements,
    );

    await fs.writeFile(fileUri, updatedContent);
    return { success: true };
  };
