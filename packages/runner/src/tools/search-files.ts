import * as fs from "node:fs";
import { getLogger } from "@ragdoll/common";
import { searchFilesWithRipgrep } from "@ragdoll/common/node";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import type { RunnerContext } from "../task-runner";

const logger = getLogger("searchFiles");

export const searchFiles =
  (
    context: Pick<RunnerContext, "cwd" | "rg">,
  ): ToolFunctionType<ClientToolsType["searchFiles"]> =>
  async ({ path, regex, filePattern }, { abortSignal }) => {
    const rgPath = context.rg;
    if (!rgPath || !fs.existsSync(rgPath)) {
      logger.error("Ripgrep not found at path", rgPath);
      throw new Error(`Ripgrep not found at path: ${rgPath}`);
    }
    return await searchFilesWithRipgrep(
      path,
      regex,
      rgPath,
      context.cwd,
      filePattern,
      abortSignal,
    );
  };
