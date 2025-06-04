import { globFiles as globFilesImpl } from "@ragdoll/common/node";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { getWorkspacePath } from "../lib/fs";

/**
 * Finds files matching a glob pattern within the specified directory
 */
export const globFiles: ToolFunctionType<ClientToolsType["globFiles"]> = async (
  { path: searchPath, globPattern },
  { abortSignal },
) => {
  return globFilesImpl({
    cwd: getWorkspacePath(),
    path: searchPath,
    globPattern,
    abortSignal,
  });
};
