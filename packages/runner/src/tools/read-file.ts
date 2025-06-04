import * as fs from "node:fs/promises";
import * as nodePath from "node:path";
import { selectFileContent, validateTextFile } from "@ragdoll/common/node";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { getWorkspacePath } from "../lib/fs";

export const readFile: ToolFunctionType<ClientToolsType["readFile"]> = async ({
  path,
  startLine,
  endLine,
}) => {
  const fileBuffer = await fs.readFile(nodePath.join(getWorkspacePath(), path));
  await validateTextFile(fileBuffer);

  const fileContent = fileBuffer.toString();
  const addLineNumbers = !!process.env.VSCODE_TEST_OPTIONS;

  return selectFileContent(fileContent, {
    startLine,
    endLine,
    addLineNumbers,
  });
};
