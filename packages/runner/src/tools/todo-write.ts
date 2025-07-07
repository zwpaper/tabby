import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";

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
  (_options: ToolCallOptions): ToolFunctionType<ClientToolsType["todoWrite"]> =>
  async () => {
    return {
      success: true,
    };
  };
