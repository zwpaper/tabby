import type RagdollWebviewProvider from "@/integrations/webview/ragdoll-webview-provider";
import type { AuthClient } from "@/lib/auth-client";
import type { AuthEvents } from "@/lib/auth-events";
import type { TokenStorage } from "@/lib/token-storage";
import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import * as vscode from "vscode";

export default function createCommands(
  ragdoll: RagdollWebviewProvider,
  tokenStorage: TokenStorage,
  authClient: AuthClient,
  authEvents: AuthEvents,
) {
  return [
    vscode.commands.registerCommand("ragdoll.accountSettings", async () => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Loading..." });
          await vscode.commands.executeCommand("ragdollWebui.focus");

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
                  authEvents.logoutEvent.fire();
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

    vscode.commands.registerCommand(
      "ragdoll.createTask",
      async (prompt: string) => {
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
          },
          async (progress) => {
            progress.report({ message: "Pochi: Creating task..." });
            await vscode.commands.executeCommand("ragdollWebui.focus");
            const webviewHost = await ragdoll.retrieveWebviewHost();
            webviewHost.openTask({ taskId: "new", prompt: prompt });
          },
        );
      },
    ),

    vscode.commands.registerCommand(
      "ragdoll.openTask",
      async (taskId: number) => {
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
          },
          async (progress) => {
            progress.report({ message: "Pochi: Opening task..." });
            await vscode.commands.executeCommand("ragdollWebui.focus");
            const webviewHost = await ragdoll.retrieveWebviewHost();
            await webviewHost.openTask({ taskId });
          },
        );
      },
    ),

    vscode.commands.registerCommand(
      "ragdoll.webui.navigate.newTask",
      async () => {
        await vscode.commands.executeCommand("ragdollWebui.focus");
        const webviewHost = await ragdoll.retrieveWebviewHost();
        webviewHost.openTask({ taskId: "new" });
      },
    ),

    vscode.commands.registerCommand(
      "ragdoll.webui.navigate.taskList",
      async () => {
        await vscode.commands.executeCommand("ragdollWebui.focus");
        const webviewHost = await ragdoll.retrieveWebviewHost();
        webviewHost.openTaskList();
      },
    ),
  ];
}
