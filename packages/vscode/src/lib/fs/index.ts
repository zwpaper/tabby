import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

export { ignoreWalk } from "./ignore-walk";

/**
 * Create a temporary file with a unique name
 */
export function tempfile(options: { extension?: string } = {}): string {
  let { extension } = options;

  if (typeof extension === "string") {
    extension = extension.startsWith(".") ? extension : `.${extension}`;
  }

  const tempDirectory = fs.realpathSync(os.tmpdir());
  return path.join(tempDirectory, randomUUID() + (extension ?? ""));
}

/**
 * Get the workspace folder or throw an error if none exists
 */
export function getWorkspaceFolder(): vscode.WorkspaceFolder {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error("No workspace folder found. Please open a workspace.");
  }
  return workspaceFolders[0];
}

/**
 * Write content to a file
 */
export async function writeFile(
  uri: vscode.Uri,
  content: string,
): Promise<void> {
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
}

/**
 * Ensure a directory exists by creating it if needed
 */
export async function ensureFileDirectoryExists(
  fileUri: vscode.Uri,
): Promise<void> {
  const dirUri = vscode.Uri.joinPath(fileUri, "..");
  await vscode.workspace.fs.createDirectory(dirUri);
}
