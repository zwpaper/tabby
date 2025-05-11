import type { AuthClient } from "@/lib/auth-client";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { AuthEvents } from "@/lib/auth-events";
import { inject, injectable, singleton } from "tsyringe";
import * as vscode from "vscode";

const label = "Pochi";
const iconCheck = "$(check)";
const iconCross = "$(x)";
const fgColorNormal = new vscode.ThemeColor("statusBar.foreground");
const fgColorWarning = new vscode.ThemeColor("statusBarItem.warningForeground");
const bgColorNormal = new vscode.ThemeColor("statusBar.background");
const bgColorWarning = new vscode.ThemeColor("statusBarItem.warningBackground");
const tooltip = "Click to login/logout";

@injectable()
@singleton()
export class StatusBarController implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  constructor(
    @inject("AuthClient") private readonly authClient: AuthClient,
    private readonly authEvents: AuthEvents,
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
    );
    this.statusBarItem.tooltip = tooltip;
    this.statusBarItem.command = "ragdoll.showCommandPalette";

    this.refresh(); // Initial refresh
    this.statusBarItem.show();

    // Register event listeners and add them to disposables
    this.disposables.push(
      this.authEvents.loginEvent.event(() => this.refresh()),
      this.authEvents.logoutEvent.event(() => this.refresh()),
      this.statusBarItem, // Add statusBarItem itself to disposables
    );
  }

  private async refresh() {
    const { data: session, error } = await this.authClient.getSession();
    if (!session || error) {
      this.statusBarItem.text = `${iconCross} ${label}`;
      this.statusBarItem.color = fgColorWarning;
      this.statusBarItem.backgroundColor = bgColorWarning;
    } else {
      this.statusBarItem.text = `${iconCheck} ${label}`;
      this.statusBarItem.color = fgColorNormal;
      this.statusBarItem.backgroundColor = bgColorNormal;
    }
  }

  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = []; // Clear the array after disposing
  }
}
