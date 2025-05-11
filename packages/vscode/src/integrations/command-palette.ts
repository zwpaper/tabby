import * as vscode from "vscode";

interface PochiQuickPickItem extends vscode.QuickPickItem {
  command: string;
  args?: unknown[];
}

export class CommandPalette {
  async show() {
    const items: PochiQuickPickItem[] = [
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

    const selectedItem = await vscode.window.showQuickPick(items, {
      title: "Pochi Command Palette",
    });

    if (selectedItem) {
      vscode.commands.executeCommand(
        selectedItem.command,
        ...(selectedItem.args || []),
      );
    }
  }
}
