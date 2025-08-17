import { getWorkspaceFolder } from "@/lib/fs";
import { listFiles as listFilesImpl } from "@getpochi/common/tool-utils";
import type { ClientTools, ToolFunctionType } from "@getpochi/tools";

/**
 * Lists files and directories within the specified path
 */
export const listFiles: ToolFunctionType<ClientTools["listFiles"]> = async (
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
