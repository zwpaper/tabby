import type * as vscode from "vscode";

export interface FileResult {
  uri: vscode.Uri;
  isDir: boolean;
  relativePath: string;
}
