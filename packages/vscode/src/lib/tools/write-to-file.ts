import { extname } from "node:path";
import * as vscode from "vscode";

import type { ClientToolsType } from "@ragdoll/tools";
import type { PreviewToolFunctionType } from "@ragdoll/tools/src/types";
import { tempfile } from "../file-utils";

async function upsertPreviewData(
  toolCallId: string,
  path: string,
  content: string,
) {
  const extension = `${toolCallId}${extname(path)}`;
  let previewTextDocument = vscode.workspace.textDocuments.find((doc) =>
    doc.uri.fsPath.endsWith(extension),
  );
  const writeFile = (uri: vscode.Uri) =>
    vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));

  if (!previewTextDocument) {
    const tmpfile = tempfile({ extension });
    const fileUri = vscode.Uri.file(tmpfile);
    await writeFile(fileUri);
    previewTextDocument = await vscode.workspace.openTextDocument(fileUri);
  } else {
    await writeFile(previewTextDocument.uri);
  }

  return previewTextDocument;
}

export const previewWriteToFile: PreviewToolFunctionType<
  ClientToolsType["writeToFile"]
> = async (args, { toolCallId }) => {
  const { path, content } = args || {};
  if (path === undefined || content === undefined) return;

  // Get the workspace folder to construct the full path
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error("No workspace folder found. Please open a workspace.");
  }

  const textDocument = await upsertPreviewData(toolCallId, path, content);
  const pathUri = vscode.Uri.joinPath(workspaceFolders[0].uri, path);
  const fileExist = await vscode.workspace.fs.stat(pathUri).then(
    () => true,
    () => false,
  );

  // Check if the document is already the active editor
  const isActive = vscode.window.activeTextEditor?.document === textDocument;

  if (!isActive) {
    if (fileExist) {
      await vscode.commands.executeCommand(
        "vscode.diff",
        pathUri,
        textDocument.uri,
        `${path} (Preview)`,
      );
    } else {
      await vscode.window.showTextDocument(textDocument);
    }
  }
};
