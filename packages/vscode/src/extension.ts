import RagdollUriHandler from "@/integrations/uri-handler";
import RagdollWebviewProvider from "@/integrations/webview/ragdoll-webview-provider";
import * as vscode from "vscode";
import createCommands from "./commands";
import { PochiConfiguration } from "./integrations/configuration";
import { DiffOriginContentProvider } from "./integrations/editor/diff-origin-content-provider";
import { createAuthClient } from "./lib/auth-client";
import { authEvents } from "./lib/auth-events";
import { Extension } from "./lib/extension";
import { NewProjectRegistry } from "./lib/new-project-registry";
import { TokenStorage } from "./lib/token-storage";
import { WorkspaceJobQueue } from "./lib/workspace-job";
import createStatusBarItem from "./status-bar";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  console.log("activating Ragdoll...");
  Extension.getInstance(context);

  const workspaceJobQueue = new WorkspaceJobQueue(context);
  const newProjectRegistry = new NewProjectRegistry(context);
  const tokenStorage = new TokenStorage(context);
  const authClient = createAuthClient(tokenStorage);

  // Configuration
  const pochiConfiguration = new PochiConfiguration();
  context.subscriptions.push(pochiConfiguration.listen());

  // Status bar
  const statusBarItem = createStatusBarItem(authClient, authEvents);
  context.subscriptions.push(...statusBarItem);

  // Webview
  const ragdoll = RagdollWebviewProvider.getInstance(
    context.extensionUri,
    tokenStorage,
    pochiConfiguration,
    authEvents,
  );
  const ragdollWebviewProvider = vscode.window.registerWebviewViewProvider(
    RagdollWebviewProvider.viewType,
    ragdoll,
    { webviewOptions: { retainContextWhenHidden: true } },
  );
  context.subscriptions.push(ragdollWebviewProvider);

  // Uri handler
  const ragdollUriHandler = new RagdollUriHandler(
    authClient,
    workspaceJobQueue,
    newProjectRegistry,
    authEvents.loginEvent,
  );
  context.subscriptions.push(
    vscode.window.registerUriHandler(ragdollUriHandler),
  );

  // Commands
  const commands = createCommands(
    ragdoll,
    tokenStorage,
    newProjectRegistry,
    authClient,
    authEvents,
  );
  context.subscriptions.push(...commands);

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      DiffOriginContentProvider.scheme,
      new DiffOriginContentProvider(),
    ),
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
