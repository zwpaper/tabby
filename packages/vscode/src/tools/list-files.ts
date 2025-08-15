import { getWorkspaceFolder } from "@/lib/fs";
import type { ClientToolsType, ToolFunctionType } from "@getpochi/tools";
import { listFiles as listFilesImpl } from "@ragdoll/common/tool-utils";

/**
 * Lists files and directories within the specified path
 */
export const listFiles: ToolFunctionType<ClientToolsType["listFiles"]> = async (
  { path: dirPath, recursive },
  { abortSignal },
) => {
  return await listFilesImpl({
    cwd: getWorkspaceFolder().uri.fsPath,
    path: dirPath,
    recursive,
    abortSignal,
  });
};
