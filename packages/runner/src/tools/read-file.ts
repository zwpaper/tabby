import * as fs from "node:fs/promises";
import type { ClientToolsV5Type, ToolFunctionTypeV5 } from "@getpochi/tools";
import {
  resolvePath,
  selectFileContent,
  validateTextFile,
} from "@ragdoll/common/node";
import type { ToolCallOptions } from "../types";

export const readFile =
  (
    context: ToolCallOptions,
  ): ToolFunctionTypeV5<ClientToolsV5Type["readFile"]> =>
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
