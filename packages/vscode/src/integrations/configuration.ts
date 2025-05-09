import * as vscode from "vscode";

import { signal } from "@preact/signals-core";

export class PochiConfiguration {
  isDevMode = signal(getPochiAdvanceSettings().isDevMode ?? false);

  constructor() {
    const settings = getPochiAdvanceSettings();
    this.isDevMode.value = settings.isDevMode ?? false;
  }

  listen(): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("pochi.settings.advanced")) {
        const settings = getPochiAdvanceSettings();
        this.isDevMode.value = settings.isDevMode ?? false;
      }
    });
  }
}

function getPochiAdvanceSettings() {
  return vscode.workspace
    .getConfiguration("pochi")
    .get("settings.advanced", {}) as { isDevMode?: boolean };
}
