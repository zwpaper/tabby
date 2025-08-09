import { getWorkspaceFolder } from "@/lib/fs";
import type { ClientToolsV5Type, ToolFunctionTypeV5 } from "@getpochi/tools";
import { listFiles as listFilesImpl } from "@ragdoll/common/node";

/**
 * Lists files and directories within the specified path
 */
export const listFiles: ToolFunctionTypeV5<
  ClientToolsV5Type["listFiles"]
> = async ({ path: dirPath, recursive }, { abortSignal }) => {
  return await listFilesImpl({
    cwd: getWorkspaceFolder().uri.fsPath,
    path: dirPath,
    recursive,
    abortSignal,
  });
};
