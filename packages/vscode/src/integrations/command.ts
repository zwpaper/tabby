// biome-ignore lint/style/useImportType: needed for dependency injection
import { RagdollWebviewProvider } from "@/integrations/webview/ragdoll-webview-provider";
import type { AuthClient } from "@/lib/auth-client";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { AuthEvents } from "@/lib/auth-events";
import { getWorkspaceRulesFileUri } from "@/lib/env";
import { getLogger, showOutputPanel } from "@/lib/logger";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { NewProjectRegistry, prepareProject } from "@/lib/new-project";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { TokenStorage } from "@/lib/token-storage";
import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import type { TaskIdParams } from "@ragdoll/vscode-webui-bridge";
import { inject, injectable, singleton } from "tsyringe";
import * as vscode from "vscode";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { CommandPalette } from "./command-palette";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { McpHub } from "./mcp/mcp-hub";
import type { McpServerConfig } from "./mcp/types";
import type { NewProjectTask } from "./uri-handler";

const logger = getLogger("CommandManager");

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
    private readonly mcpHub: McpHub,
  ) {
    this.registerCommands();
  }

  private async prepareProjectAndOpenTask(
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    workspaceUri: vscode.Uri,
    githubTemplateUrl: string | undefined,
    openTaskParams: TaskIdParams,
    requestId?: string,
  ) {
    await vscode.commands.executeCommand("pochiWebui.focus");

    if (githubTemplateUrl) {
      await prepareProject(workspaceUri, githubTemplateUrl, progress);
    }

    const webviewHost = await this.ragdollWebviewProvider.retrieveWebviewHost();
    webviewHost.openTask(openTaskParams);

    if (requestId) {
      await this.newProjectRegistry.set(requestId, workspaceUri);
    }
  }

  private registerCommands() {
    this.disposables.push(
      vscode.commands.registerCommand("pochi.openLoginPage", async () => {
        vscode.env.openExternal(
          vscode.Uri.parse(
            `${getServerBaseUrl()}/auth/vscode-link?uriScheme=${vscode.env.uriScheme}`,
          ),
        );
      }),

      vscode.commands.registerCommand("pochi.logout", async () => {
        const selection = await vscode.window.showInformationMessage(
          "Are you sure you want to logout?",
          { modal: true },
          "Logout",
        );
        if (selection === "Logout") {
          this.authClient.signOut();
          const tokenSignal = await this.tokenStorage.token;
          tokenSignal.value = undefined;
          this.authEvents.logoutEvent.fire();
        }
      }),

      vscode.commands.registerCommand("pochi.editWorkspaceRules", async () => {
        try {
          const workspaceRulesUri = getWorkspaceRulesFileUri();
          let textDocument: vscode.TextDocument;

          try {
            textDocument =
              await vscode.workspace.openTextDocument(workspaceRulesUri);
          } catch (error) {
            const fileContent = "<!-- Add your custom workspace rules here -->";
            await vscode.workspace.fs.writeFile(
              workspaceRulesUri,
              Buffer.from(fileContent, "utf8"),
            );
            textDocument =
              await vscode.workspace.openTextDocument(workspaceRulesUri);
          }

          await vscode.window.showTextDocument(textDocument);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          vscode.window.showErrorMessage(
            `Pochi: Failed to open workspace rules. ${errorMessage}`,
          );
        }
      }),

      vscode.commands.registerCommand(
        "pochi.createProject",
        async (task: NewProjectTask) => {
          const params = task.event.data;
          const currentWorkspace = vscode.workspace.workspaceFolders?.[0].uri;
          if (!currentWorkspace) {
            return;
          }

          return vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              cancellable: false,
            },
            async (progress) => {
              try {
                progress.report({ message: "Pochi: Creating project..." });
                await this.prepareProjectAndOpenTask(
                  progress,
                  currentWorkspace,
                  params.githubTemplateUrl,
                  {
                    uid: task.uid,
                  },
                  params.requestId,
                );
              } catch (error) {
                const errorMessage =
                  error instanceof Error ? error.message : "Unknown error";
                vscode.window.showErrorMessage(
                  `Pochi: Failed to create project. ${errorMessage}`,
                );
              }
            },
          );
        },
      ),

      vscode.commands.registerCommand(
        "pochi.prepareEvaluationProject",
        async (params: {
          uid: string;
          batchId: string;
          githubTemplateUrl: string;
        }) => {
          const currentWorkspace = vscode.workspace.workspaceFolders?.[0].uri;
          if (!currentWorkspace) {
            vscode.window.showErrorMessage(
              "No workspace folder found for evaluation project",
            );
            return;
          }

          return vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              cancellable: false,
            },
            async (progress) => {
              try {
                progress.report({
                  message: "Pochi: Preparing evaluation project...",
                });
                await this.prepareProjectAndOpenTask(
                  progress,
                  currentWorkspace,
                  params.githubTemplateUrl,
                  {
                    uid: params.uid,
                  },
                );
              } catch (error) {
                const errorMessage =
                  error instanceof Error ? error.message : "Unknown error";
                vscode.window.showErrorMessage(
                  `Pochi: Failed to prepare evaluation project. ${errorMessage}`,
                );
              }
            },
          );
        },
      ),

      vscode.commands.registerCommand("pochi.openTask", async (uid: string) => {
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
          },
          async (progress) => {
            progress.report({ message: "Pochi: Opening task..." });
            await vscode.commands.executeCommand("pochiWebui.focus");
            const webviewHost =
              await this.ragdollWebviewProvider.retrieveWebviewHost();
            webviewHost.openTask({ uid });
          },
        );
      }),

      vscode.commands.registerCommand(
        "pochi.webui.navigate.newTask",
        async () => {
          await vscode.commands.executeCommand("pochiWebui.focus");
          const webviewHost =
            await this.ragdollWebviewProvider.retrieveWebviewHost();
          webviewHost.openTask({ uid: undefined });
        },
      ),

      vscode.commands.registerCommand(
        "pochi.webui.navigate.taskList",
        async () => {
          await vscode.commands.executeCommand("pochiWebui.focus");
          const webviewHost =
            await this.ragdollWebviewProvider.retrieveWebviewHost();
          webviewHost.openTaskList();
        },
      ),

      vscode.commands.registerCommand(
        "pochi.webui.navigate.settings",
        async () => {
          await vscode.commands.executeCommand("pochiWebui.focus");
          const webviewHost =
            await this.ragdollWebviewProvider.retrieveWebviewHost();
          webviewHost.openSettings();
        },
      ),

      vscode.commands.registerCommand("pochi.openSettings", async () => {
        vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "@ext:tabbyml.pochi",
        );
      }),

      vscode.commands.registerCommand(
        "pochi.showCommandPalette",
        this.commandPalette.show.bind(this.commandPalette),
      ),

      vscode.commands.registerCommand(
        "pochi.outputPanel.focus",
        showOutputPanel,
      ),

      vscode.commands.registerCommand(
        "pochi.mcp.addServer",
        async (name?: string, recommendedServer?: McpServerConfig) => {
          this.mcpHub.addServer(name, recommendedServer);
          vscode.commands.executeCommand("workbench.action.openSettingsJson", {
            revealSetting: { key: "pochi.mcpServers" },
          });
        },
      ),

      vscode.commands.registerCommand(
        "pochi.mcp.openServerSettings",
        async () => {
          vscode.commands.executeCommand("workbench.action.openSettingsJson", {
            revealSetting: { key: "pochi.mcpServers" },
          });
        },
      ),

      vscode.commands.registerCommand(
        "pochi.mcp.serverControl",
        async (action: string, serverName: string) => {
          switch (action) {
            case "start":
              this.mcpHub.start(serverName);
              break;
            case "stop":
              this.mcpHub.stop(serverName);
              break;
            case "restart":
              this.mcpHub.restart(serverName);
              break;
            default:
              vscode.window.showErrorMessage(
                `Unknown MCP server action: ${action}`,
              );
          }
        },
      ),

      vscode.commands.registerCommand(
        "pochi.mcp.toggleToolEnabled",
        async (serverName: string, toolName: string) => {
          this.mcpHub.toggleToolEnabled(serverName, toolName);
        },
      ),

      vscode.commands.registerCommand("pochi.toggleFocus", async () => {
        const webviewHost =
          await this.ragdollWebviewProvider.retrieveWebviewHost();
        if (await webviewHost.isFocused()) {
          logger.debug("Focused on editor");
          await vscode.commands.executeCommand(
            "workbench.action.focusActiveEditorGroup",
          );
        } else {
          logger.debug("Focused on webui");
          await vscode.commands.executeCommand("pochiWebui.focus");
        }
      }),
    );
  }

  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}
