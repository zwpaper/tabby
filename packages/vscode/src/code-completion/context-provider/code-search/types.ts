import type * as vscode from "vscode";

export interface DocumentRange {
  document: vscode.TextDocument;
  range: vscode.Range;
}
