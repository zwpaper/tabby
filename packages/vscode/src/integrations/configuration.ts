import { signal } from "@preact/signals-core";
import { injectable, singleton } from "tsyringe";
import * as vscode from "vscode";
import type { McpServerConfig } from "./mcp/types";

@injectable()
@singleton()
export class PochiConfiguration implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  readonly advancedSettings = signal(getPochiAdvanceSettings());
  readonly mcpServers = signal(getPochiMcpServersSettings());
  readonly webui = signal(getPochiWebviewLogSettings());
  readonly autoSaveDisabled = signal(getAutoSaveDisabled());

  constructor() {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("pochi.advanced")) {
          const settings = getPochiAdvanceSettings();
          this.advancedSettings.value = settings;
        }
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

    this.disposables.push({
      dispose: this.mcpServers.subscribe((value) => {
        updatePochiMcpServersSettings(value);
      }),
    });
    this.disposables.push({
      dispose: this.advancedSettings.subscribe((value) => {
        updatePochiAdvanceSettings(value);
      }),
    });
  }

  dispose() {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

type PochiAdvanceSettings = {
  enableInlineCompletion?: boolean; // FIXME(zhiming): remove this after feature is stable
  inlineCompletion?: {
    disabled?: boolean;
    disabledLanguages?: string[];
  };
};

function getPochiAdvanceSettings() {
  return vscode.workspace
    .getConfiguration("pochi")
    .get("advanced", {}) as PochiAdvanceSettings;
}

async function updatePochiAdvanceSettings(value: PochiAdvanceSettings) {
  return vscode.workspace
    .getConfiguration("pochi")
    .update("advanced", value, true);
}

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
