import type * as vscode from "vscode";

export interface FileResult {
  uri: vscode.Uri;
  relativePath: string;
  fullPath: string;
  basename: string;
}
