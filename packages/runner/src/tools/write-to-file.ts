import * as fs from "node:fs/promises";
import * as nodePath from "node:path";
import { fixCodeGenerationOutput } from "@ragdoll/common/output-utils";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { getWorkspacePath } from "../lib/fs";

/**
 * Implements the writeToFile tool for VSCode extension.
 * Writes content to a specified file, creating directories if needed.
 */
export const writeToFile: ToolFunctionType<
  ClientToolsType["writeToFile"]
> = async ({ path, content }) => {
  const workspaceFolder = getWorkspacePath();
  const fileUri = nodePath.join(workspaceFolder, path);
  const processedContent = fixCodeGenerationOutput(content);
  await fs.writeFile(fileUri, processedContent);
  return { success: true };
};
