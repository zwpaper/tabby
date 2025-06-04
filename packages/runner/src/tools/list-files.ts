import { listFiles as listFilesImpl } from "@ragdoll/common/node";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { getWorkspacePath } from "../lib/fs";

/**
 * Lists files and directories within the specified path
 */
export const listFiles: ToolFunctionType<ClientToolsType["listFiles"]> = async (
  { path: dirPath, recursive },
  { abortSignal },
) => {
  return listFilesImpl({
    cwd: getWorkspacePath(),
    path: dirPath,
    recursive,
    abortSignal,
  });
};
