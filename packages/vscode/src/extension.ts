import "reflect-metadata";
// FIXME(wei): required for vscode version <= 1.100, update vscode version to remove this polyfill
import "iterator-helpers-polyfill";

import RagdollUriHandler from "@/integrations/uri-handler";
import { RagdollWebviewProvider } from "@/integrations/webview/ragdoll-webview-provider";
import { container, instanceCachingFactory } from "tsyringe";
import type * as vscode from "vscode";
import { CompletionConfiguration } from "./completion/configuration";
import { CompletionStatusBarManager } from "./completion/status-bar-manager";
import { PochiAuthenticationProvider } from "./integrations/auth-provider";
import { CommandManager } from "./integrations/command";
import { DiffOriginContentProvider } from "./integrations/editor/diff-origin-content-provider";
import { McpHub } from "./integrations/mcp/mcp-hub";
import { TerminalLinkProvider } from "./integrations/terminal-link-provider";
import {
  type ApiClient,
  type AuthClient,
  createApiClient,
  createAuthClient,
} from "./lib/auth-client";
import { FileLogger } from "./lib/file-logger";
import { PostInstallActions } from "./lib/post-install-actions";
import { TokenStorage } from "./lib/token-storage";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  console.log("activating Pochi...");

  // Container will dispose all the registered instances when itself is disposed
  context.subscriptions.push(container);
  await container.resolve(TokenStorage).init();

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

  container.resolve(PochiAuthenticationProvider);
  container.resolve(RagdollWebviewProvider);
  container.resolve(RagdollUriHandler);
  container.resolve(CompletionConfiguration);
  container.resolve(CompletionStatusBarManager);
  container.resolve(CommandManager);
  container.resolve(DiffOriginContentProvider);
  container.resolve(McpHub);
  container.resolve(PostInstallActions);
  container.resolve(FileLogger);
  container.resolve(TerminalLinkProvider);
}

// This method is called when your extension is deactivated
export function deactivate() {}
