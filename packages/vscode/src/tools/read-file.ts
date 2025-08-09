import { getWorkspaceFolder } from "@/lib/fs";
import type { ClientToolsV5Type, ToolFunctionTypeV5 } from "@getpochi/tools";
import {
  resolvePath,
  selectFileContent,
  validateTextFile,
} from "@ragdoll/common/node";
import * as vscode from "vscode";

export const readFile: ToolFunctionTypeV5<
  ClientToolsV5Type["readFile"]
> = async ({ path, startLine, endLine }) => {
  const workspaceFolder = getWorkspaceFolder();

  const resolvedPath = resolvePath(path, workspaceFolder.uri.fsPath);
  const fileUri = vscode.Uri.file(resolvedPath);

  const fileBuffer = await vscode.workspace.fs.readFile(fileUri);
  await validateTextFile(fileBuffer);

  const fileContent = fileBuffer.toString();
  const addLineNumbers = !!process.env.VSCODE_TEST_OPTIONS;

  return selectFileContent(fileContent, {
    startLine,
    endLine,
    addLineNumbers,
  });
};
