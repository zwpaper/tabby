import * as vscode from "vscode";
import createCommands from "./commands";
import { authEvents } from "./helpers/auth-events";
import { Extension } from "./helpers/extension";
import { GlobalJobsRunner } from "./helpers/global-jobs";
import RagdollUriHandler from "./helpers/uri-handler";
import { createAuthClient } from "./lib/auth-client";
import { TokenStorage } from "./lib/token-storage";
import Ragdoll from "./ragdoll";
import createStatusBarItem from "./status-bar";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  console.log("activating Ragdoll...");
  Extension.getInstance(context);

  const globalJobRunner = new GlobalJobsRunner(context);
  const tokenStorage = new TokenStorage(context);
  const authClient = createAuthClient(tokenStorage);

  // Status bar
  const statusBarItem = createStatusBarItem(authClient, authEvents);
  context.subscriptions.push(...statusBarItem);

  // Webview
  const ragdoll = Ragdoll.getInstance(
    context.extensionUri,
    tokenStorage,
    authEvents,
  );
  const ragdollWebviewProvider = vscode.window.registerWebviewViewProvider(
    Ragdoll.viewType,
    ragdoll,
    { webviewOptions: { retainContextWhenHidden: true } },
  );
  context.subscriptions.push(ragdollWebviewProvider);

  // Uri handler
  const ragdollUriHandler = new RagdollUriHandler(
    authClient,
    globalJobRunner,
    authEvents.loginEvent,
  );
  context.subscriptions.push(
    vscode.window.registerUriHandler(ragdollUriHandler),
  );

  // Commands
  const commands = createCommands(
    ragdoll,
    tokenStorage,
    authClient,
    authEvents,
  );
  context.subscriptions.push(...commands);
}

// This method is called when your extension is deactivated
export function deactivate() {}
