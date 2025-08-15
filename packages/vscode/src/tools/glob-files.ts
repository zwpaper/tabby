import { getWorkspaceFolder } from "@/lib/fs";
import type { ClientToolsType, ToolFunctionType } from "@getpochi/tools";
import { globFiles as globFilesImpl } from "@ragdoll/common/tool-utils";

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
