import type { AuthClient } from "@/lib/auth-client";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { AuthEvents } from "@/lib/auth-events";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { NewProjectRegistry, createNewWorkspace } from "@/lib/new-project";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { WorkspaceJobQueue } from "@/lib/workspace-job";
import type { NewTaskAttachment } from "@ragdoll/vscode-webui-bridge";
import { inject, injectable, singleton } from "tsyringe";
import * as vscode from "vscode";

export interface NewProjectParams {
  requestId?: string;

  /**
   * project name
   */
  name?: string;

  /**
   * user input prompt message
   */
  prompt: string;

  /**
   * user attached files
   */
  attachments?: NewTaskAttachment[];

  /**
   * A zip url to download the project template from.
   * example: https://github.com/wsxiaoys/reimagined-octo-funicular
   */
  githubTemplateUrl?: string;
}

@injectable()
@singleton()
class RagdollUriHandler implements vscode.UriHandler, vscode.Disposable {
  constructor(
    @inject("AuthClient")
    private readonly authClient: AuthClient,
    private readonly workspaceJobQueue: WorkspaceJobQueue,
    private readonly newProjectRegistry: NewProjectRegistry,
    private readonly authEvents: AuthEvents,
  ) {}

  private registeration = vscode.window.registerUriHandler(this);
  dispose() {
    this.registeration.dispose();
  }

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
        const decoded = Buffer.from(newProject, "base64").toString("utf-8");
        const params = JSON.parse(decoded) as NewProjectParams;
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
    const { requestId, name } = params;

    if (requestId) {
      const createdProject = this.newProjectRegistry.get(requestId);
      if (createdProject) {
        await this.workspaceJobQueue.push({
          workspaceUri: createdProject.toString(),
          command: "ragdollWebui.focus",
          args: [],
          expiresAt: Date.now() + 1000 * 60,
        });

        // open the new workspace
        await vscode.commands.executeCommand(
          "vscode.openFolder",
          createdProject,
          {
            forceNewWindow: true,
          },
        );
        return;
      }
    }

    const newWorkspaceUri = await createNewWorkspace(name);

    if (!newWorkspaceUri) {
      vscode.window.showWarningMessage("Cancelled creating new workspace.");
      return;
    }

    // push a global job to create task after the new workspace is opened
    await this.workspaceJobQueue.push({
      workspaceUri: newWorkspaceUri.toString(),
      command: "ragdoll.createProject",
      args: [params],
      expiresAt: Date.now() + 1000 * 60,
    });

    // open the new workspace
    await vscode.commands.executeCommand("vscode.openFolder", newWorkspaceUri, {
      forceReuseWindow: true,
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
        this.authEvents.loginEvent.fire();
      },
    );
  }
}

export default RagdollUriHandler;
