import type { ClientToolsV5Type, ToolFunctionTypeV5 } from "@getpochi/tools";
import { globFiles as globFilesImpl } from "@ragdoll/common/node";
import type { ToolCallOptions } from "../types";

/**
 * Finds files matching a glob pattern within the specified directory
 */
export const globFiles =
  (
    context: ToolCallOptions,
  ): ToolFunctionTypeV5<ClientToolsV5Type["globFiles"]> =>
  async ({ path: searchPath, globPattern }, { abortSignal }) => {
    return globFilesImpl({
      cwd: context.cwd,
      path: searchPath,
      globPattern,
      abortSignal,
    });
  };
