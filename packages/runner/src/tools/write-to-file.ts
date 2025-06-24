import * as fs from "node:fs/promises";
import * as nodePath from "node:path";
import { fixCodeGenerationOutput } from "@ragdoll/common/output-utils";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import type { RunnerContext } from "../task-runner";

/**
 * Implements the writeToFile tool for runner.
 * Writes content to a specified file, creating directories if needed.
 */
export const writeToFile =
  (
    context: Pick<RunnerContext, "cwd">,
  ): ToolFunctionType<ClientToolsType["writeToFile"]> =>
  async ({ path, content }) => {
    const fileUri = nodePath.join(context.cwd, path);
    const processedContent = fixCodeGenerationOutput(content);
    await fs.writeFile(fileUri, processedContent);
    return { success: true };
  };
