// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { Extension } from "./helpers/extension";
import RagdollUriHandler from "./helpers/uri-handler";
import { createAuthClient } from "./lib/auth-client";
import Ragdoll from "./ragdoll";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  Extension.getInstance(context);

  const authClient = createAuthClient(context);

  const ragdoll = vscode.window.registerWebviewViewProvider(
    Ragdoll.viewType,
    Ragdoll.getInstance(context.extensionUri),
  );
  context.subscriptions.push(ragdoll);

  const ragdollUriHandler = new RagdollUriHandler(authClient);
  context.subscriptions.push(
    vscode.window.registerUriHandler(ragdollUriHandler),
  );

  const commandRegisterations = [
    vscode.commands.registerCommand("ragdoll.accountSettings", async () => {
      const { data: session, error } = await authClient.getSession();
      if (!session || error) {
        const loginSelection = "Login";
        vscode.window
          .showInformationMessage("You're not logged-in", loginSelection)
          .then((selection) => {
            if (selection === loginSelection) {
              vscode.env.openExternal(
                vscode.Uri.parse("https://app.getpochi.com/auth/vscode-link"),
              );
            }
          });
      }
      if (session) {
        vscode.window.showInformationMessage(
          `You're logged-in as ${session.user.email}`,
        );
      }
    }),
  ];
  context.subscriptions.push(...commandRegisterations);
}

// This method is called when your extension is deactivated
export function deactivate() {}
