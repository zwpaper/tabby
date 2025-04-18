// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { Extension } from "./helpers/extension";
import RagdollUriHandler from "./helpers/uri-handler";
import Ragdoll from "./ragdoll";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  Extension.getInstance(context);

  const ragdoll = vscode.window.registerWebviewViewProvider(
    Ragdoll.viewType,
    Ragdoll.getInstance(context.extensionUri),
  );
  context.subscriptions.push(ragdoll);

  const ragdollUriHandler = new RagdollUriHandler(context);
  context.subscriptions.push(
    vscode.window.registerUriHandler(ragdollUriHandler),
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
