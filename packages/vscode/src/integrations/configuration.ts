import { signal } from "@preact/signals-core";
import { injectable, singleton } from "tsyringe";
import * as vscode from "vscode";

@injectable()
@singleton()
export class PochiConfiguration implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  isDevMode = signal(getPochiAdvanceSettings().isDevMode ?? false);

  constructor() {
    const settings = getPochiAdvanceSettings();
    this.isDevMode.value = settings.isDevMode ?? false;

    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("pochi.settings.advanced")) {
          const settings = getPochiAdvanceSettings();
          this.isDevMode.value = settings.isDevMode ?? false;
        }
      }),
    );

    this.disposables.push({
      dispose: this.isDevMode.subscribe((value) => {
        updatePochiAdvanceSettings({ isDevMode: value });
      }),
    });
  }

  dispose() {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

interface PochiAdvanceSettings {
  isDevMode?: boolean;
}

function getPochiAdvanceSettings() {
  return vscode.workspace
    .getConfiguration("pochi")
    .get("settings.advanced", {}) as PochiAdvanceSettings;
}

async function updatePochiAdvanceSettings(value: PochiAdvanceSettings) {
  return vscode.workspace
    .getConfiguration("pochi")
    .update("settings.advanced", value, true);
}
