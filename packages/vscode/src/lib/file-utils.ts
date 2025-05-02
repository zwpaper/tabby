import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type WorkspaceFolder, workspace } from "vscode";

export function tempfile(options: { extension?: string } = {}): string {
  let { extension } = options;

  if (typeof extension === "string") {
    extension = extension.startsWith(".") ? extension : `.${extension}`;
  }

  const tempDirectory = fs.realpathSync(os.tmpdir());
  return path.join(tempDirectory, randomUUID() + (extension ?? ""));
}

export function isAbsolutePath(p: string): boolean {
  return p.startsWith("/") || p.startsWith("\\") || /^[A-Za-z]:/.test(p);
}

export function getWorkspaceFolder(): WorkspaceFolder {
  const workspaceFolders = workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error("No workspace folder found. Please open a workspace.");
  }
  return workspaceFolders[0];
}
