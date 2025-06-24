import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import type { RunnerContext } from "../task-runner";

/**
 * Implements the todoWrite tool for runner.
 * Currently a no-op implementation that just returns success.
 */
export const todoWrite =
  (
    _context: Pick<RunnerContext, never>,
  ): ToolFunctionType<ClientToolsType["todoWrite"]> =>
  async () => {
    return {
      success: true,
    };
  };
