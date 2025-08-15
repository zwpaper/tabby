import { getWorkspaceFolder } from "@/lib/fs";
import type { ClientToolsType, ToolFunctionType } from "@getpochi/tools";
import {
  resolvePath,
  selectFileContent,
  validateTextFile,
} from "@ragdoll/common/tool-utils";
import * as vscode from "vscode";

export const readFile: ToolFunctionType<ClientToolsType["readFile"]> = async ({
  path,
  startLine,
  endLine,
}) => {
  const workspaceFolder = getWorkspaceFolder();

  const resolvedPath = resolvePath(path, workspaceFolder.uri.fsPath);
  const fileUri = vscode.Uri.file(resolvedPath);

  await validateTextFile(fileUri.fsPath);
  const fileContent = (await vscode.workspace.fs.readFile(fileUri)).toString();

  const addLineNumbers = !!process.env.VSCODE_TEST_OPTIONS;

  return selectFileContent(fileContent, {
    startLine,
    endLine,
    addLineNumbers,
  });
};
