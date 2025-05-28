import { homedir } from "node:os";
import type { ApiClient, AuthClient } from "@/lib/auth-client";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { AuthEvents } from "@/lib/auth-events";
import { getLogger } from "@/lib/logger";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { NewProjectRegistry, createNewWorkspace } from "@/lib/new-project";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { WorkspaceJobQueue } from "@/lib/workspace-job";
import type { DB } from "@ragdoll/db";
import { inject, injectable, singleton } from "tsyringe";
import * as vscode from "vscode";
export interface NewProjectTask {
  event: Extract<DB["task"]["event"], { type: "website:new-project" }>;
}
interface EvaluationTask {
  id: number;
  event: Extract<DB["task"]["event"], { type: "batch:evaluation" }>;
}

const logger = getLogger("RagdollUriHandler");

function getEvaluationProjectUri(batchId: string, taskId: number): vscode.Uri {
  const homeUri = vscode.Uri.file(homedir());
  const evaluationBaseUri = vscode.Uri.joinPath(
    homeUri,
    "PochiProjects",
    "evaluation-tests",
    batchId,
  );
  return vscode.Uri.joinPath(evaluationBaseUri, `prompt-${taskId}`);
}

@injectable()
@singleton()
class RagdollUriHandler implements vscode.UriHandler, vscode.Disposable {
  constructor(
    @inject("AuthClient")
    private readonly authClient: AuthClient,
    @inject("ApiClient")
    private readonly apiClient: ApiClient,
    private readonly workspaceJobQueue: WorkspaceJobQueue,
    private readonly newProjectRegistry: NewProjectRegistry,
    private readonly authEvents: AuthEvents,
  ) {}

  private registeration = vscode.window.registerUriHandler(this);
  dispose() {
    this.registeration.dispose();
  }

  handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
    logger.debug("handleUri", uri.toString());
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

    const task = searchParams.get("task");
    if (task) {
      const taskIdInt = Number.parseInt(task);
      if (!Number.isNaN(taskIdInt)) {
        await this.handleTaskEvent(taskIdInt);
        return;
      }
    }
  }

  private async handleTaskEvent(taskId: number) {
    const taskResponse = await this.apiClient.api.tasks[":id"].$get({
      param: { id: taskId.toString() },
    });

    if (!taskResponse.ok) {
      vscode.window.showErrorMessage(
        `Failed to get task ${taskId}: ${taskResponse.status}`,
      );
      return;
    }

    const task = await taskResponse.json();
    switch (task.event?.type) {
      case "batch:evaluation":
        await this.handleEvaluationTask(task as EvaluationTask);
        break;
      case "website:new-project":
        await this.handleNewProjectTask(task as NewProjectTask);
        break;
      default:
        // default to open the task
        await vscode.commands.executeCommand("ragdoll.openTask", taskId);
        break;
    }
  }
  async handleNewProjectTask(task: NewProjectTask) {
    const { data: params } = task.event;
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
      vscode.window.showWarningMessage("Cancelled creating new project.");
      return;
    }

    // push a global job to create task after the new workspace is opened
    await this.workspaceJobQueue.push({
      workspaceUri: newWorkspaceUri.toString(),
      command: "ragdoll.createProject",
      args: [task],
      expiresAt: Date.now() + 1000 * 60,
    });

    // open the new workspace
    await vscode.commands.executeCommand("vscode.openFolder", newWorkspaceUri, {
      forceReuseWindow: true,
    });
  }

  private async handleEvaluationTask(task: EvaluationTask) {
    const batchId = task.event.data.batchId;

    const evaluationProjectDir = getEvaluationProjectUri(batchId, task.id);

    await vscode.workspace.fs.createDirectory(evaluationProjectDir);

    // Push job to prepare the evaluation project and open the existing task
    await this.workspaceJobQueue.push({
      workspaceUri: evaluationProjectDir.toString(),
      command: "ragdoll.prepareEvaluationProject",
      args: [
        {
          taskId: task.id,
          batchId,
          githubTemplateUrl: task.event.data.githubTemplateUrl,
        },
      ],
      expiresAt: Date.now() + 1000 * 60,
    });

    await vscode.commands.executeCommand(
      "vscode.openFolder",
      evaluationProjectDir,
      {
        forceNewWindow: true,
      },
    );
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

        this.authEvents.loginEvent.fire();
      },
    );
  }
}

export default RagdollUriHandler;
