import * as fs from "node:fs/promises";
import type { ClientToolsType, ToolFunctionType } from "@getpochi/tools";
import {
  resolvePath,
  selectFileContent,
  validateTextFile,
} from "@ragdoll/common/tool-utils";
import type { ToolCallOptions } from "../types";

export const readFile =
  (context: ToolCallOptions): ToolFunctionType<ClientToolsType["readFile"]> =>
  async ({ path, startLine, endLine }) => {
    const resolvedPath = resolvePath(path, context.cwd);
    await validateTextFile(resolvedPath);
    const fileContent = (await fs.readFile(resolvedPath)).toString();

    const addLineNumbers = !!process.env.VSCODE_TEST_OPTIONS;

    return selectFileContent(fileContent, {
      startLine,
      endLine,
      addLineNumbers,
    });
  };
