import type { ClientToolsV5Type, ToolFunctionTypeV5 } from "@getpochi/tools";

/**
 * Implements the todoWrite tool for runner.
 * Currently a no-op implementation that just returns success.
 */
import type { ToolCallOptions } from "../types";

/**
 * Implements the todoWrite tool for runner.
 * Currently a no-op implementation that just returns success.
 */
export const todoWrite =
  (
    _options: ToolCallOptions,
  ): ToolFunctionTypeV5<ClientToolsV5Type["todoWrite"]> =>
  async () => {
    return {
      success: true,
    };
  };
