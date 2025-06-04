import { getWorkspaceFolder } from "@/lib/fs";
import { globFiles as globFilesImpl } from "@ragdoll/common/node";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";

/**
 * Finds files matching a glob pattern within the specified directory
 */
export const globFiles: ToolFunctionType<ClientToolsType["globFiles"]> = async (
  { path: searchPath, globPattern },
  { abortSignal },
) => {
  const workspaceFolder = getWorkspaceFolder();

  return globFilesImpl({
    cwd: workspaceFolder.uri.fsPath,
    path: searchPath,
    globPattern,
    abortSignal,
  });
};
