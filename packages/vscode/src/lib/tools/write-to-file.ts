import { extname } from "node:path";
import * as vscode from "vscode";

import type { ClientToolsType } from "@ragdoll/tools";
import type {
  PreviewToolFunctionType,
  ToolFunctionType,
} from "@ragdoll/tools/src/types";
import {
  ensureDirectoryExists,
  getWorkspaceFolder,
  tempfile,
  writeFile,
} from "../file-utils";
import { getLogger } from "../logger";
import { closePreviewTabs, findPreviewTabs } from "../tab-utils";

const logger = getLogger("writeToFileTool");

async function upsertPreviewData(
  toolCallId: string,
  path: string,
  content: string,
) {
  logger.debug(
    `Upserting preview data for path: ${path}, toolCallId: ${toolCallId}`,
  );
  const extension = `${toolCallId}${extname(path)}`;
  logger.trace("use extension", extension);

  let previewTextDocument = vscode.workspace.textDocuments.find((doc) =>
    doc.uri.fsPath.endsWith(extension),
  );

  if (!previewTextDocument) {
    logger.debug("No existing preview document found, creating new one");
    const tmpfile = tempfile({ extension });
    logger.trace(`Created temp file: ${tmpfile}`);
    const fileUri = vscode.Uri.file(tmpfile);
    await writeFile(fileUri, content);
    previewTextDocument = await vscode.workspace.openTextDocument(fileUri);
    logger.debug(
      `Created new preview document: ${previewTextDocument.uri.fsPath}`,
    );
  } else {
    logger.debug(
      `Updating existing preview document: ${previewTextDocument.uri.fsPath}`,
    );
    await writeFile(previewTextDocument.uri, content);
  }

  return previewTextDocument;
}

export const previewWriteToFile: PreviewToolFunctionType<
  ClientToolsType["writeToFile"]
> = async (args, { toolCallId }) => {
  const { path, content } = args || {};
  if (path === undefined || content === undefined) return;

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    logger.error("No workspace folder found");
    throw new Error("No workspace folder found. Please open a workspace.");
  }

  const textDocument = await upsertPreviewData(toolCallId, path, content);

  const pathUri = vscode.Uri.joinPath(workspaceFolders[0].uri, path);
  const fileExist = await vscode.workspace.fs.stat(pathUri).then(
    () => true,
    () => false,
  );
  logger.debug(`File exists: ${fileExist}`);

  const isActive = findPreviewTabs(toolCallId, "(Preview)").length > 0;
  logger.debug(
    `Preview document is active editor: ${isActive} fileExist: ${fileExist}, doc: ${textDocument.uri.fsPath}`,
  );

  if (!isActive) {
    await vscode.commands.executeCommand(
      "vscode.diff",
      fileExist
        ? pathUri
        : (
            await vscode.workspace.openTextDocument({
              language: textDocument.languageId,
            })
          ).uri,
      textDocument.uri,
      `${path} (Preview)`,
      {
        preview: false,
      },
    );
  }
};

/**
 * Implements the writeToFile tool for VSCode extension.
 * Writes content to a specified file, creating directories if needed.
 */
export const writeToFile: ToolFunctionType<
  ClientToolsType["writeToFile"]
> = async (
  { path, content }: { path: string; content: string },
  { toolCallId },
) => {
  const workspaceFolder = getWorkspaceFolder();

  try {
    const pathUri = vscode.Uri.joinPath(workspaceFolder.uri, path);
    logger.debug(`Target file URI: ${pathUri.fsPath}`);

    const dirUri = vscode.Uri.joinPath(pathUri, "..");
    await ensureDirectoryExists(dirUri);
    await writeFile(pathUri, content);
    logger.trace("Writing file success:", pathUri.fsPath);

    const previewTabs = findPreviewTabs(toolCallId, "(Preview)");
    await closePreviewTabs(previewTabs);

    const document = await vscode.workspace.openTextDocument(pathUri);
    await vscode.window.showTextDocument(document);
    logger.info(`Document opened in editor: ${path}`);

    return { success: true };
  } catch (error) {
    logger.error(`Failed to write to file: ${error}`);
    throw new Error(`Failed to write to file: ${error}`);
  }
};
