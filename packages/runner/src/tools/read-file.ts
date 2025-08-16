import * as fs from "node:fs/promises";
import {
  resolvePath,
  selectFileContent,
  validateTextFile,
} from "@getpochi/common/tool-utils";
import type { ClientToolsType, ToolFunctionType } from "@getpochi/tools";
import type { ToolCallOptions } from "../types";

export const readFile =
  (context: ToolCallOptions): ToolFunctionType<ClientToolsType["readFile"]> =>
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
