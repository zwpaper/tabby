import { signal } from "@preact/signals-core";
import { injectable, singleton } from "tsyringe";
import * as vscode from "vscode";

@injectable()
@singleton()
export class PochiConfiguration implements vscode.Disposable {
  isDevMode = signal(getPochiAdvanceSettings().isDevMode ?? false);

  private readonly listener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("pochi.settings.advanced")) {
      const settings = getPochiAdvanceSettings();
      this.isDevMode.value = settings.isDevMode ?? false;
    }
  });

  constructor() {
    const settings = getPochiAdvanceSettings();
    this.isDevMode.value = settings.isDevMode ?? false;
  }

  dispose() {
    this.listener.dispose();
  }
}

function getPochiAdvanceSettings() {
  return vscode.workspace
    .getConfiguration("pochi")
    .get("settings.advanced", {}) as { isDevMode?: boolean };
}
