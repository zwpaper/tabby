import { getWorkspaceFolder } from "@/lib/fs";
import type { ClientToolsV5Type, ToolFunctionTypeV5 } from "@getpochi/tools";
import { globFiles as globFilesImpl } from "@ragdoll/common/node";

/**
 * Finds files matching a glob pattern within the specified directory
 */
export const globFiles: ToolFunctionTypeV5<
  ClientToolsV5Type["globFiles"]
> = async ({ path: searchPath, globPattern }, { abortSignal }) => {
  const workspaceFolder = getWorkspaceFolder();

  return globFilesImpl({
    cwd: workspaceFolder.uri.fsPath,
    path: searchPath,
    globPattern,
    abortSignal,
  });
};
