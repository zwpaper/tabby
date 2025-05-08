import type * as vscode from "vscode";

export class DiffOriginContentProvider
  implements vscode.TextDocumentContentProvider
{
  static readonly scheme = "pochi-diff-origin";

  provideTextDocumentContent(uri: vscode.Uri): string {
    return Buffer.from(uri.query, "base64").toString("utf-8");
  }
}
