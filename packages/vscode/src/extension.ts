// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import VscodeReactStarterView from "./VscodeReactStarterView";
import { Extension } from "./helpers/Extension";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  Extension.getInstance(context);

  const vscodeReactStarterView = vscode.window.registerWebviewViewProvider(
    VscodeReactStarterView.viewType,
    VscodeReactStarterView.getInstance(context.extensionUri),
  );

  context.subscriptions.push(vscodeReactStarterView);
}

// This method is called when your extension is deactivated
export function deactivate() {}
