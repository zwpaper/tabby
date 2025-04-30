import type { AuthClient } from "@/lib/auth-client";
import * as vscode from "vscode";

const label = "Pochi";
const iconCheck = "$(check)";
const iconCross = "$(x)";
const fgColorNormal = new vscode.ThemeColor("statusBar.foreground");
const fgColorWarning = new vscode.ThemeColor("statusBarItem.warningForeground");
const bgColorNormal = new vscode.ThemeColor("statusBar.background");
const bgColorWarning = new vscode.ThemeColor("statusBarItem.warningBackground");
const tooltip = "Click to login/logout";

function createStatusBarItem(
  authClient: AuthClient,
  events: {
    loginEvent: vscode.EventEmitter<void>;
    logoutEvent: vscode.EventEmitter<void>;
  },
) {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
  );
  statusBarItem.tooltip = tooltip;
  statusBarItem.command = "ragdoll.accountSettings";

  const refresh = async () => {
    const { data: session, error } = await authClient.getSession();
    if (!session || error) {
      statusBarItem.text = `${iconCross} ${label}`;
      statusBarItem.color = fgColorWarning;
      statusBarItem.backgroundColor = bgColorWarning;
    } else {
      statusBarItem.text = `${iconCheck} ${label}`;
      statusBarItem.color = fgColorNormal;
      statusBarItem.backgroundColor = bgColorNormal;
    }
  };

  statusBarItem.show();
  refresh();

  const disposables = [
    events.loginEvent.event(refresh),
    events.logoutEvent.event(refresh),
  ];

  return [statusBarItem, ...disposables];
}

export default createStatusBarItem;
