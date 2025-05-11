// biome-ignore lint/style/useImportType: needed for dependency injection
import RagdollWebviewProvider from "@/integrations/webview/ragdoll-webview-provider";
import type { AuthClient } from "@/lib/auth-client";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { AuthEvents } from "@/lib/auth-events";
import { showOutputPanel } from "@/lib/logger";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { NewProjectRegistry, prepareProject } from "@/lib/new-project";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { TokenStorage } from "@/lib/token-storage";
import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import { inject, injectable, singleton } from "tsyringe";
import * as vscode from "vscode";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { CommandPalette } from "./command-palette";
import type { NewProjectParams } from "./uri-handler";

@injectable()
@singleton()
export class CommandManager implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly ragdollWebviewProvider: RagdollWebviewProvider,
    private readonly tokenStorage: TokenStorage,
    private readonly newProjectRegistry: NewProjectRegistry,
    @inject("AuthClient") private readonly authClient: AuthClient,
    private readonly authEvents: AuthEvents,
    private readonly commandPalette: CommandPalette,
  ) {
    this.registerCommands();
  }

  private registerCommands() {
    this.disposables.push(
      vscode.commands.registerCommand("ragdoll.accountSettings", async () => {
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
          },
          async (progress) => {
            progress.report({ message: "Loading..." });
            await vscode.commands.executeCommand("ragdollWebui.focus");

            const { data: session, error } = await this.authClient.getSession();

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
                    this.authClient.signOut();
                    this.tokenStorage.setToken(undefined);
                    this.authEvents.logoutEvent.fire();
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
        "ragdoll.createProject",
        async (params: NewProjectParams) => {
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              cancellable: false,
            },
            async (progress) => {
              progress.report({ message: "Pochi: Creating project..." });

              await vscode.commands.executeCommand("ragdollWebui.focus");

              const currentWorkspace =
                vscode.workspace.workspaceFolders?.[0].uri;
              if (!currentWorkspace) {
                return;
              }
              if (params.githubTemplateUrl) {
                await prepareProject(
                  currentWorkspace,
                  params.githubTemplateUrl,
                  progress,
                );
              }

              const webviewHost =
                await this.ragdollWebviewProvider.retrieveWebviewHost();
              webviewHost.openTask({
                taskId: "new",
                prompt: params.prompt,
                attachments: params.attachments,
              });

              if (params.requestId) {
                await this.newProjectRegistry.set(
                  params.requestId,
                  currentWorkspace,
                );
              }
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
              const webviewHost =
                await this.ragdollWebviewProvider.retrieveWebviewHost();
              webviewHost.openTask({ taskId });
            },
          );
        },
      ),

      vscode.commands.registerCommand(
        "ragdoll.webui.navigate.newTask",
        async () => {
          await vscode.commands.executeCommand("ragdollWebui.focus");
          const webviewHost =
            await this.ragdollWebviewProvider.retrieveWebviewHost();
          webviewHost.openTask({ taskId: "new" });
        },
      ),

      vscode.commands.registerCommand(
        "ragdoll.webui.navigate.taskList",
        async () => {
          await vscode.commands.executeCommand("ragdollWebui.focus");
          const webviewHost =
            await this.ragdollWebviewProvider.retrieveWebviewHost();
          webviewHost.openTaskList();
        },
      ),

      vscode.commands.registerCommand("ragdoll.openSettings", async () => {
        vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "@ext:tabbyml.pochi",
        );
      }),

      vscode.commands.registerCommand(
        "ragdoll.showCommandPalette",
        this.commandPalette.show.bind(this.commandPalette),
      ),

      vscode.commands.registerCommand(
        "ragdoll.outputPanel.focus",
        showOutputPanel,
      ),
    );
  }

  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}
