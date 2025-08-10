import type { ClientToolsV5Type, ToolFunctionTypeV5 } from "@getpochi/tools";
import { listFiles as listFilesImpl } from "@ragdoll/common/node";
import type { ToolCallOptions } from "../types";

/**
 * Lists files and directories within the specified path
 */
export const listFiles =
  (
    context: ToolCallOptions,
  ): ToolFunctionTypeV5<ClientToolsV5Type["listFiles"]> =>
  async ({ path: dirPath, recursive }, { abortSignal }) => {
    return listFilesImpl({
      cwd: context.cwd,
      path: dirPath,
      recursive,
      abortSignal,
    });
  };
