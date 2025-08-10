import * as fs from "node:fs/promises";
import * as nodePath from "node:path";
import type { ClientToolsV5Type, ToolFunctionTypeV5 } from "@getpochi/tools";
import { fixCodeGenerationOutput } from "@ragdoll/common/output-utils";
import type { ToolCallOptions } from "../types";

/**
 * Implements the writeToFile tool for runner.
 * Writes content to a specified file, creating directories if needed.
 */
export const writeToFile =
  (
    context: ToolCallOptions,
  ): ToolFunctionTypeV5<ClientToolsV5Type["writeToFile"]> =>
  async ({ path, content }) => {
    const fileUri = nodePath.join(context.cwd, path);
    const processedContent = fixCodeGenerationOutput(content);
    await fs.writeFile(fileUri, processedContent);
    return { success: true };
  };
