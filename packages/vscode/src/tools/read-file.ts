import { getWorkspaceFolder } from "@/lib/fs";
import {
  resolvePath,
  selectFileContent,
  validateTextFile,
} from "@getpochi/common/tool-utils";
import type { ClientTools, ToolFunctionType } from "@getpochi/tools";
import * as vscode from "vscode";

export const readFile: ToolFunctionType<ClientTools["readFile"]> = async ({
  path,
  startLine,
  endLine,
}) => {
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
