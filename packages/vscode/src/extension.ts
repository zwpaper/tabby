import "reflect-metadata";

import RagdollUriHandler from "@/integrations/uri-handler";
import { RagdollWebviewProvider } from "@/integrations/webview/ragdoll-webview-provider";
import { container, instanceCachingFactory } from "tsyringe";
import type * as vscode from "vscode";
import { CommandManager } from "./integrations/command";
import { DiffOriginContentProvider } from "./integrations/editor/diff-origin-content-provider";
import { McpHub } from "./integrations/mcp/mcp-hub";
import { type AuthClient, createAuthClient } from "./lib/auth-client";
import { type ApiClient, createApiClient } from "./lib/auth-client";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  console.log("activating Pochi...");

  // Container will dispose all the registered instances when itself is disposed
  context.subscriptions.push(container);

  container.register<vscode.ExtensionContext>("vscode.ExtensionContext", {
    useValue: context,
  });
  container.register<AuthClient>("AuthClient", {
    // AuthClient is also a singleton
    useFactory: instanceCachingFactory(createAuthClient),
  });
  container.register<ApiClient>("ApiClient", {
    // ApiClient is also a singleton
    useFactory: instanceCachingFactory(createApiClient),
  });

  container.resolve(RagdollWebviewProvider);
  container.resolve(RagdollUriHandler);
  container.resolve(CommandManager);
  container.resolve(DiffOriginContentProvider);
  container.resolve(McpHub);
}

// This method is called when your extension is deactivated
export function deactivate() {}
