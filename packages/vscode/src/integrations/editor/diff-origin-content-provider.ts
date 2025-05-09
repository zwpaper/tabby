import { injectable, singleton } from "tsyringe";
import * as vscode from "vscode";

@injectable()
@singleton()
export class DiffOriginContentProvider
  implements vscode.TextDocumentContentProvider, vscode.Disposable
{
  static readonly scheme = "pochi-diff-origin";

  provideTextDocumentContent(uri: vscode.Uri): string {
    return Buffer.from(uri.query, "base64").toString("utf-8");
  }

  private registeration = vscode.workspace.registerTextDocumentContentProvider(
    DiffOriginContentProvider.scheme,
    this,
  );

  dispose() {
    this.registeration.dispose();
  }
}
