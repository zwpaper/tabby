// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import Ragdoll from "./Ragdoll";
import { Extension } from "./helpers/extension";
import uriHandler from "./helpers/uri-handler";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  Extension.getInstance(context);

  const ragdoll = vscode.window.registerWebviewViewProvider(
    Ragdoll.viewType,
    Ragdoll.getInstance(context.extensionUri),
  );

  context.subscriptions.push(ragdoll);
  context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));
}

// This method is called when your extension is deactivated
export function deactivate() {}
