import { signal } from "@preact/signals-core";
import { injectable, singleton } from "tsyringe";
import * as vscode from "vscode";

@injectable()
@singleton()
export class TabState implements vscode.Disposable {
  // Signal containing the current active tabs
  activeTabs = signal(listOpenTabs());
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Set up listeners for tab changes and active editor changes
   */
  private setupEventListeners() {
    // Set up tab change detection
    this.disposables.push(
      vscode.window.tabGroups.onDidChangeTabs(this.onTabChanged),
    );

    // Also update when active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(this.onTabChanged),
    );
  }

  /**
   * Update the active tabs signal when tabs change
   */
  private onTabChanged = () => {
    // Update the existing signal value instead of creating a new signal
    this.activeTabs.value = listOpenTabs();
  };

  /**
   * Release all resources held by this class
   */
  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}

function listOpenTabs(): { filepath: string; isDir: boolean }[] {
  const currentOpenTabFiles: { filepath: string; isDir: boolean }[] = [];
  const processedFilepaths = new Set<string>(); // To ensure uniqueness by final relative filepath

  // Prioritize active editor
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor?.document) {
    const relativePath = vscode.workspace.asRelativePath(
      activeEditor.document.uri,
    );
    if (!processedFilepaths.has(relativePath)) {
      currentOpenTabFiles.push({ filepath: relativePath, isDir: false });
      processedFilepaths.add(relativePath);
    }
  }

  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      let uri: vscode.Uri | undefined;

      if (tab.input instanceof vscode.TabInputText) {
        uri = tab.input.uri;
      } else if (tab.input instanceof vscode.TabInputTextDiff) {
        uri = tab.input.modified;
      } else if (tab.input instanceof vscode.TabInputNotebook) {
        uri = tab.input.uri;
      } else if (tab.input instanceof vscode.TabInputNotebookDiff) {
        uri = tab.input.modified;
      } else if (tab.input instanceof vscode.TabInputCustom) {
        uri = tab.input.uri;
      }
      // Other tab input types like vscode.TabInputWebview or vscode.TabInputTerminal are generally not considered file-backed code editors.

      if (uri) {
        const relativePath = vscode.workspace.asRelativePath(uri);
        if (!processedFilepaths.has(relativePath)) {
          currentOpenTabFiles.push({ filepath: relativePath, isDir: false });
          processedFilepaths.add(relativePath);
        }
      }
    }
  }
  return currentOpenTabFiles;
}
