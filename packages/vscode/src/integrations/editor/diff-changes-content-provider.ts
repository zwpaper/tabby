import { injectable, singleton } from "tsyringe";
import * as vscode from "vscode";

@injectable()
@singleton()
export class DiffChangesContentProvider
  implements vscode.TextDocumentContentProvider, vscode.Disposable
{
  static readonly scheme = "pochi-diff-changes";

  provideTextDocumentContent(uri: vscode.Uri): string {
    return Buffer.from(uri.query, "base64").toString("utf-8");
  }

  private registeration = vscode.workspace.registerTextDocumentContentProvider(
    DiffChangesContentProvider.scheme,
    this,
  );

  dispose() {
    this.registeration.dispose();
  }
}
