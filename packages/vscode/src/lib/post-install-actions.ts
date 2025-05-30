import { inject, injectable, singleton } from "tsyringe";
import * as vscode from "vscode";
import { getLogger } from "./logger";

const logger = getLogger("PostInstallActions");

@singleton()
@injectable()
export class PostInstallActions {
  private actions: Action[] = [];

  constructor(
    @inject("vscode.ExtensionContext") private context: vscode.ExtensionContext,
  ) {
    this.actions.push(new SetRemoteDefaultExtensionAction(this.context));

    this.runActions();
  }

  private async runActions(): Promise<void> {
    for (const action of this.actions) {
      if (!this.isActionCompleted(action.id)) {
        try {
          await action.execute();
          await this.markActionCompleted(action.id);
        } catch (error) {
          logger.error(
            `Failed to execute post-install action ${action.id}:`,
            error,
          );
        }
      }
    }
  }

  private isActionCompleted(actionId: string): boolean {
    return this.context.globalState.get<boolean>(
      this.getActionKey(actionId),
      false,
    );
  }

  private async markActionCompleted(actionId: string): Promise<void> {
    await this.context.globalState.update(this.getActionKey(actionId), true);
  }

  private getActionKey(actionId: string): string {
    return `post_install_action.${actionId}`;
  }
}

interface Action {
  id: string;
  execute(): Promise<void>;
}

class SetRemoteDefaultExtensionAction implements Action {
  id = "set_remote_default_extension";

  constructor(private context: vscode.ExtensionContext) {}

  async execute(): Promise<void> {
    const extensionId = this.context.extension.id;
    const config = vscode.workspace.getConfiguration("remote");
    const currentValue: string[] =
      config.get("defaultExtensionsIfInstalledLocally") || [];

    if (!currentValue.includes(extensionId)) {
      await config.update(
        "defaultExtensionsIfInstalledLocally",
        [...currentValue, extensionId],
        vscode.ConfigurationTarget.Global,
      );

      logger.info(
        `Added ${extensionId} to remote.defaultExtensionsIfInstalledLocally`,
      );
    }
  }
}
