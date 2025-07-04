import { signal } from "@preact/signals-core";
import { injectable, singleton } from "tsyringe";
import * as vscode from "vscode";
import type { McpServerConfig } from "./mcp/types";

@injectable()
@singleton()
export class PochiConfiguration implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  // isDevMode = signal(getPochiAdvanceSettings().isDevMode ?? false);
  readonly mcpServers = signal(getPochiMcpServersSettings());

  readonly webui = signal(getPochiWebviewLogSettings());

  readonly autoSaveDisabled = signal(getAutoSaveDisabled());

  constructor() {
    // const settings = getPochiAdvanceSettings();
    // this.isDevMode.value = settings.isDevMode ?? false;

    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        // if (e.affectsConfiguration("pochi.settings.advanced")) {
        // const settings = getPochiAdvanceSettings();
        // this.isDevMode.value = settings.isDevMode ?? false;
        // }
        if (e.affectsConfiguration("pochi.mcpServers")) {
          const settings = getPochiMcpServersSettings();
          this.mcpServers.value = settings;
        }

        if (e.affectsConfiguration("pochi.webui")) {
          const settings = getPochiWebviewLogSettings();
          this.webui.value = settings;
        }

        if (e.affectsConfiguration("files.autoSave")) {
          this.autoSaveDisabled.value = getAutoSaveDisabled();
        }
      }),
    );

    this.disposables.push(
      // {
      //   dispose: this.isDevMode.subscribe((value) => {
      //     updatePochiAdvanceSettings({ isDevMode: value });
      //   }),
      // },
      {
        dispose: this.mcpServers.subscribe((value) => {
          updatePochiMcpServersSettings(value);
        }),
      },
    );
  }

  dispose() {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

// interface PochiAdvanceSettings {
//   isDevMode?: boolean;
// }

// function getPochiAdvanceSettings() {
//   return vscode.workspace
//     .getConfiguration("pochi")
//     .get("settings.advanced", {}) as PochiAdvanceSettings;
// }

// async function updatePochiAdvanceSettings(value: PochiAdvanceSettings) {
//   return vscode.workspace
//     .getConfiguration("pochi")
//     .update("settings.advanced", value, true);
// }

export type PochiMcpServersSettings = Record<string, McpServerConfig>;

function getPochiMcpServersSettings() {
  return vscode.workspace
    .getConfiguration("pochi")
    .get("mcpServers", {}) as PochiMcpServersSettings;
}

async function updatePochiMcpServersSettings(value: PochiMcpServersSettings) {
  return vscode.workspace
    .getConfiguration("pochi")
    .update("mcpServers", value, true);
}

interface PochiWebUISettings {
  POCHI_LOG?: string;
}

function getPochiWebviewLogSettings() {
  return vscode.workspace
    .getConfiguration("pochi")
    .get("webui", {}) as PochiWebUISettings;
}

function getAutoSaveDisabled() {
  const autoSave = vscode.workspace
    .getConfiguration("files")
    .get<string>("autoSave", "off");

  return autoSave === "off";
}
