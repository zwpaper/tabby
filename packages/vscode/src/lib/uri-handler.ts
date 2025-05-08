import type { AuthClient } from "@/lib/auth-client";
import { createNewProject } from "@/lib/new-project-utils";
import type { WorkspaceJobQueue } from "@/lib/workspace-job";
import * as vscode from "vscode";

export interface NewProjectParams {
  /**
   * user input prompt message
   */
  prompt: string;

  /**
   * A zip url to download the project template from.
   * example: https://github.com/wsxiaoys/reimagined-octo-funicular/archive/refs/heads/main.zip
   */
  template?: string;
}

class RagdollUriHandler implements vscode.UriHandler {
  constructor(
    private readonly authClient: AuthClient,
    private readonly globalJobsRunner: WorkspaceJobQueue,
    private readonly loginEvent: vscode.EventEmitter<void>,
  ) {}

  handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
    this.handleUriImpl(uri);
  }

  async handleUriImpl(uri: vscode.Uri) {
    await vscode.commands.executeCommand("ragdollWebui.focus");

    const searchParams = new URLSearchParams(uri.query);
    const token = searchParams.get("token");
    if (token) {
      await this.loginWithDeviceLink(token);
      return;
    }

    const newProject = searchParams.get("newProject");
    if (newProject) {
      try {
        const params = JSON.parse(newProject) as NewProjectParams;
        await this.handleNewProjectRequest(params);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to create new project: ${error}`,
        );
      }
      return;
    }

    const task = searchParams.get("task");
    if (task) {
      const taskId = Number.parseInt(task);
      if (Number.isNaN(taskId)) {
        vscode.window.showErrorMessage("Invalid task id");
        return;
      }

      await vscode.commands.executeCommand("ragdoll.openTask", taskId);
      return;
    }
  }

  async handleNewProjectRequest(params: NewProjectParams) {
    const { prompt, template } = params;

    const newProjectUri = await createNewProject(template);

    // push a global job to create task after the new workspace is opened
    await this.globalJobsRunner.push({
      workspaceUri: newProjectUri.toString(),
      command: "ragdoll.createTask",
      args: [prompt],
      expiresAt: Date.now() + 1000 * 60,
    });

    // open the new workspace
    await vscode.commands.executeCommand("vscode.openFolder", newProjectUri, {
      forceNewWindow: true,
    });
  }

  async loginWithDeviceLink(token: string) {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Login in progress, please wait..." });

        const { data, error } = await this.authClient.deviceLink.verify({
          query: { token },
        });

        if (error || "error" in data) {
          vscode.window.showErrorMessage("Failed to login, please try again.");
          return;
        }

        vscode.window.showInformationMessage("Successfully logged in!");
        this.loginEvent.fire();
      },
    );
  }
}

export default RagdollUriHandler;
