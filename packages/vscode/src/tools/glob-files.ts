import { getWorkspaceFolder } from "@/lib/fs";
import { globFiles as globFilesImpl } from "@getpochi/common/tool-utils";
import type { ClientToolsType, ToolFunctionType } from "@getpochi/tools";

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
