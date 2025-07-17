import * as vscode from "vscode";

export function findTextEditor(uri: vscode.Uri): vscode.TextEditor | undefined {
  if (
    vscode.window.activeTextEditor?.document.uri.toString() === uri.toString()
  ) {
    return vscode.window.activeTextEditor;
  }
  return vscode.window.visibleTextEditors.find(
    (editor) => editor.document.uri.toString() === uri.toString(),
  );
}
