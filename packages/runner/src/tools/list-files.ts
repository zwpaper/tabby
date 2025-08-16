import { listFiles as listFilesImpl } from "@getpochi/common/tool-utils";
import type { ClientToolsType, ToolFunctionType } from "@getpochi/tools";
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
