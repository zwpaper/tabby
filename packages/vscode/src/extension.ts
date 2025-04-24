import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { Extension } from "./helpers/extension";
import RagdollUriHandler from "./helpers/uri-handler";
import { createAuthClient } from "./lib/auth-client";
import { TokenStorage } from "./lib/token-storage";
import Ragdoll from "./ragdoll";
import createStatusBarItem from "./status-bar";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log("activating Ragdoll...");
  Extension.getInstance(context);

  const tokenStorage = new TokenStorage(context);
  const authClient = createAuthClient(tokenStorage);

  const ragdollUriHandler = new RagdollUriHandler(authClient);
  context.subscriptions.push(
    vscode.window.registerUriHandler(ragdollUriHandler),
  );

  const logoutEvent = new vscode.EventEmitter<void>();
  const authEvents = {
    loginEvent: ragdollUriHandler.loginEvent,
    logoutEvent,
  };

  const statusBarItem = createStatusBarItem(authClient, authEvents);
  context.subscriptions.push(...statusBarItem);

  const ragdoll = vscode.window.registerWebviewViewProvider(
    Ragdoll.viewType,
    Ragdoll.getInstance(context.extensionUri, tokenStorage, authEvents),
  );
  context.subscriptions.push(ragdoll);

  const commandRegisterations = [
    vscode.commands.registerCommand("ragdoll.accountSettings", async () => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Loading..." });
          const { data: session, error } = await authClient.getSession();
          if (!session || error) {
            const loginSelection = "Login";
            vscode.window
              .showInformationMessage("You're not logged-in", loginSelection)
              .then((selection) => {
                if (selection === loginSelection) {
                  vscode.commands.executeCommand("ragdoll.openLoginPage");
                }
              });
            return;
          }
          if (session) {
            const okSelection = "Ok";
            const logoutSelection = "Logout";
            vscode.window
              .showInformationMessage(
                `You're logged-in as ${session.user.email}`,
                okSelection,
                logoutSelection,
              )
              .then((selection) => {
                if (selection === logoutSelection) {
                  authClient.signOut();
                  tokenStorage.setToken(undefined);
                  logoutEvent.fire();
                }
              });
          }
        },
      );
    }),
    vscode.commands.registerCommand("ragdoll.openLoginPage", async () => {
      vscode.env.openExternal(
        vscode.Uri.parse(`${getServerBaseUrl()}/auth/vscode-link`),
      );
    }),
  ];

  context.subscriptions.push(...commandRegisterations);
}

// This method is called when your extension is deactivated
export function deactivate() {}
