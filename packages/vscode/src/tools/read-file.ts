import * as nodePath from "node:path";
import { getWorkspaceFolder } from "@/lib/fs";
import { selectFileContent, validateTextFile } from "@ragdoll/common/node";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import * as vscode from "vscode";

export const readFile: ToolFunctionType<ClientToolsType["readFile"]> = async ({
  path,
  startLine,
  endLine,
}) => {
  const workspaceFolder = getWorkspaceFolder();

  const fileUri = vscode.Uri.file(
    nodePath.join(workspaceFolder.uri.fsPath, path),
  );

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
