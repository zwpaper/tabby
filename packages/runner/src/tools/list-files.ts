import { listFiles as listFilesImpl } from "@ragdoll/common/node";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import type { ToolCallOptions } from "../types";

/**
 * Lists files and directories within the specified path
 */
export const listFiles =
  (context: ToolCallOptions): ToolFunctionType<ClientToolsType["listFiles"]> =>
  async ({ path: dirPath, recursive }, { abortSignal }) => {
    return listFilesImpl({
      cwd: context.cwd,
      path: dirPath,
      recursive,
      abortSignal,
    });
  };
