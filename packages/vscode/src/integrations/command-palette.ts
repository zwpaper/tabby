import type { AuthClient } from "@/lib/auth-client";
import { getLogger } from "@/lib/logger";
import { inject, injectable, singleton } from "tsyringe";
import * as vscode from "vscode";

interface PochiQuickPickItem extends vscode.QuickPickItem {
  command?: string;
  args?: unknown[];
}

interface PochiQuickPickButton extends vscode.QuickInputButton {
  command?: string;
  args?: unknown[];
}

const logger = getLogger("CommandPalette");

@injectable()
@singleton()
export class CommandPalette {
  private accountQuickPickItem: PochiQuickPickItem = {
    label: "Account",
    description: "Fetching user information...",
    iconPath: new vscode.ThemeIcon("account"),
  };
  private quickPick: vscode.QuickPick<PochiQuickPickItem> | undefined;

  constructor(@inject("AuthClient") private readonly authClient: AuthClient) {}

  async show() {
    const items: PochiQuickPickItem[] = [
      this.accountQuickPickItem,
      {
        label: "Config",
        kind: vscode.QuickPickItemKind.Separator,
      },
      {
        label: "Settings",
        command: "ragdoll.openSettings",
        iconPath: new vscode.ThemeIcon("settings"),
      },
      {
        label: "Show Logs",
        command: "ragdoll.outputPanel.focus",
        iconPath: new vscode.ThemeIcon("output"),
      },
    ];

    await this.showQuickPick(items, "Pochi Command Palette");
  }

  private async showQuickPick(items: PochiQuickPickItem[], title: string) {
    return new Promise<PochiQuickPickItem | undefined>((resolve) => {
      this.quickPick = vscode.window.createQuickPick<PochiQuickPickItem>();
      this.quickPick.items = items;
      this.quickPick.title = title;
      this.quickPick.canSelectMany = false;
      this.quickPick.show();
      this.quickPick.onDidAccept(() => {
        const selectedItem = this.quickPick?.selectedItems[0];
        if (selectedItem?.command) {
          vscode.commands.executeCommand(
            selectedItem.command,
            ...(selectedItem?.args || []),
          );
        }
        resolve(selectedItem);
      });
      this.quickPick.onDidHide(() => {
        resolve(undefined);
      });
      this.quickPick.onDidTriggerItemButton(({ button, item }) => {
        const pochiButton = button as PochiQuickPickButton;
        if (item && pochiButton?.command) {
          vscode.commands.executeCommand(
            pochiButton.command,
            ...(pochiButton.args || []),
          );
        }
        resolve(item);
      });
      this.updateAuthInfo();
    });
  }

  private async updateAuthInfo() {
    if (!this.quickPick) {
      return;
    }
    this.quickPick.busy = true;
    const authinfo = await this.fetchAuthInfo();
    let accountItem: PochiQuickPickItem;
    if (authinfo.loggedIn) {
      const logoutButton: PochiQuickPickButton = {
        tooltip: "Logout",
        iconPath: new vscode.ThemeIcon("sign-out"),
        command: "ragdoll.logout",
      };
      accountItem = {
        ...this.accountQuickPickItem,
        description: `Logged in as ${authinfo.username}`,
        buttons: [logoutButton],
      };
    } else {
      accountItem = {
        ...this.accountQuickPickItem,
        description: "You're not logged-in, click to login",
        command: "ragdoll.openLoginPage",
      };
    }
    this.quickPick.busy = false;

    this.quickPick.items = this.quickPick.items.map((item) => {
      if (item.label === this.accountQuickPickItem.label) {
        return accountItem;
      }
      return item;
    });
  }

  private async fetchAuthInfo(): Promise<{
    loggedIn: boolean;
    username?: string;
  }> {
    const { data: session, error } = await this.authClient.getSession();
    logger.debug("User session data:", session, error);
    if (!session || error) {
      return { loggedIn: false };
    }
    return { loggedIn: true, username: session.user.email };
  }
}
