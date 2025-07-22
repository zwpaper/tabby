import * as fs from "node:fs";
import type { ClientToolsType, ToolFunctionType } from "@getpochi/tools";
import { getLogger } from "@ragdoll/common";
import { searchFilesWithRipgrep } from "@ragdoll/common/node";
import type { ToolCallOptions } from "../types";

const logger = getLogger("searchFiles");

export const searchFiles =
  (
    context: ToolCallOptions,
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
