import * as fs from "node:fs/promises";
import {
  resolvePath,
  selectFileContent,
  validateTextFile,
} from "@ragdoll/common/node";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import type { RunnerContext } from "../task-runner";

export const readFile =
  (
    context: Pick<RunnerContext, "cwd">,
  ): ToolFunctionType<ClientToolsType["readFile"]> =>
  async ({ path, startLine, endLine }) => {
    const resolvedPath = resolvePath(path, context.cwd);
    const fileBuffer = await fs.readFile(resolvedPath);
    await validateTextFile(fileBuffer);

    const fileContent = fileBuffer.toString();
    const addLineNumbers = !!process.env.VSCODE_TEST_OPTIONS;

    return selectFileContent(fileContent, {
      startLine,
      endLine,
      addLineNumbers,
    });
  };
