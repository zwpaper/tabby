import type { AuthClient } from "@/lib/auth-client";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { AuthEvents } from "@/lib/auth-events";
import { getLogger } from "@/lib/logger";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { NewProjectRegistry, createNewWorkspace } from "@/lib/new-project";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { WorkspaceJobQueue } from "@/lib/workspace-job";
import { WebsiteTaskCreateEvent } from "@getpochi/common";
import { inject, injectable, singleton } from "tsyringe";
import * as vscode from "vscode";

const logger = getLogger("UriHandler");

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
    logger.debug("handleUri", uri.toString());
    this.handleUriImpl(uri);
  }

  private async handleUriImpl(uri: vscode.Uri) {
    await vscode.commands.executeCommand("pochiWebui.focus");

    const searchParams = new URLSearchParams(uri.query);
    const token = searchParams.get("token");
    if (token) {
      await this.loginWithDeviceLink(token);
      return;
    }

    const eventParam = searchParams.get("event");
    if (eventParam) {
      try {
        const event = WebsiteTaskCreateEvent.parse(
          JSON.parse(decodeURIComponent(eventParam)),
        );
        await this.handleNewProjectTask(event);
      } catch (error) {
        logger.error("Failed to parse event parameter", error);
        vscode.window.showErrorMessage("Failed to process task event");
      }
      return;
    }
  }

  private async handleNewProjectTask(event: WebsiteTaskCreateEvent) {
    const { data: params } = event;
    const { uid, name } = params;

    logger.info(`Handling new project task: ${JSON.stringify(params)}`);

    if (uid) {
      const createdProject = this.newProjectRegistry.get(uid);
      if (createdProject) {
        logger.info(
          `Found existing project for requestId ${uid}: ${createdProject}`,
        );

        await this.workspaceJobQueue.push({
          workspaceUri: createdProject.toString(),
          command: "pochiWebui.focus",
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

    logger.info(
      `Created new workspace: ${newWorkspaceUri}, current workspace: ${vscode.workspace.workspaceFolders?.[0]?.uri}, POCHI_MINION_ID: ${process.env.POCHI_MINION_ID}`,
    );

    // In remote environments, check if we're already in the target workspace
    const isRemoteEnv = !!process.env.POCHI_MINION_ID;
    const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri;

    // TODO(sma1lboy): temp solution for remote env for testing
    if (
      isRemoteEnv &&
      currentWorkspace?.toString() === newWorkspaceUri.toString()
    ) {
      logger.info(
        "Already in target workspace, executing createProject directly",
      );

      // Execute the command directly instead of queueing it
      await vscode.commands.executeCommand("pochi.createProject", event);
      return;
    }

    // push a global job to create task after the new workspace is opened
    await this.workspaceJobQueue.push({
      workspaceUri: newWorkspaceUri.toString(),
      command: "pochi.createProject",
      args: [event],
      expiresAt: Date.now() + 1000 * 60,
    });

    logger.info(`Pushed job to queue for workspace: ${newWorkspaceUri}`);

    // open the new workspace
    // TODO(sma1lboy): remove this, just test to see if it works
    try {
      logger.info("Attempting to open workspace folder...");
      await vscode.commands.executeCommand(
        "vscode.openFolder",
        newWorkspaceUri,
        {
          forceReuseWindow: true,
        },
      );
      logger.info("vscode.openFolder command completed");
    } catch (error) {
      logger.error("Failed to open workspace folder", error);

      // If opening folder fails in remote env, try to execute the command directly
      if (isRemoteEnv) {
        logger.info(
          "Attempting to execute createProject directly after folder open failure",
        );
        await vscode.commands.executeCommand("pochi.createProject", event);
      }
    }
  }

  private async loginWithDeviceLink(token: string) {
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
