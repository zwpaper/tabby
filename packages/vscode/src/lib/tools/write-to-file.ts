import { promises as fs } from "node:fs";
import { extname } from "node:path";
import * as vscode from "vscode";

import { tempfile } from "@/lib/file-utils";
import type { ClientToolsType } from "@ragdoll/tools";
import type { PreviewToolFunctionType } from "./types";

const previewDocuments = new Map<string, vscode.TextDocument>();

async function updateDocument(
  toolCallId: string,
  extension: string,
  content: string,
  abortSignal?: AbortSignal,
) {
  if (!previewDocuments.has(toolCallId)) {
    abortSignal?.addEventListener("abort", () => {
      previewDocuments.delete(toolCallId);
    });

    const filepath = tempfile({ extension });
    await fs.writeFile(filepath, content);
    const textDocument = await vscode.workspace.openTextDocument(filepath);
    await vscode.window.showTextDocument(textDocument);
    previewDocuments.set(toolCallId, textDocument);
  }

  const textDocument = previewDocuments.get(toolCallId);
  if (!textDocument?.fileName) {
    throw new Error("No text document found");
  }

  const filepath = textDocument.fileName;
  await fs.writeFile(filepath, content);
}

export const previewWriteToFile: PreviewToolFunctionType<
  ClientToolsType["writeToFile"]
> = async ({ path, content }, { toolCallId, abortSignal }) => {
  // Get the workspace folder to construct the full path
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error("No workspace folder found. Please open a workspace.");
  }

  await updateDocument(toolCallId, extname(path), content, abortSignal);
};
