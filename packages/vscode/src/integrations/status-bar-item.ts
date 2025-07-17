// biome-ignore lint/style/useImportType: needed for initialization
import { CompletionProvider } from "@/code-completion";
// biome-ignore lint/style/useImportType: needed for initialization
import { AuthEvents } from "@/lib/auth-events";
import { injectable, singleton } from "tsyringe";
import * as vscode from "vscode";
// biome-ignore lint/style/useImportType: needed for initialization
import { PochiConfiguration } from "./configuration";

@injectable()
@singleton()
export class StatusBarItem implements vscode.Disposable {
  private readonly statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );

  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly pochiConfiguration: PochiConfiguration,
    private readonly authEvents: AuthEvents,
    private readonly inlineCompletionProvider: CompletionProvider,
  ) {
    this.initialize();
  }

  private initialize() {
    this.statusBarItem.show();
    this.disposables.push(this.statusBarItem);

    this.update();

    this.disposables.push({
      dispose: this.pochiConfiguration.advancedSettings.subscribe(() => {
        this.update();
      }),
    });
    this.disposables.push({
      dispose: this.authEvents.isLoggedIn.subscribe(() => {
        this.update();
      }),
    });
    this.disposables.push({
      dispose: this.inlineCompletionProvider.isFetching.subscribe(() => {
        this.update();
      }),
    });
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.update();
      }),
    );
  }

  private update(): void {
    if (this.authEvents.isLoggedIn.value === undefined) {
      this.renderStatus("loading");
      return;
    }
    if (this.authEvents.isLoggedIn.value === false) {
      this.renderStatus("logged-out");
      return;
    }
    // User logged-in

    if (
      this.pochiConfiguration.advancedSettings.value.inlineCompletion?.disabled
    ) {
      this.renderStatus("disabled");
      return;
    }
    if (
      vscode.window.activeTextEditor &&
      this.pochiConfiguration.advancedSettings.value.inlineCompletion?.disabledLanguages?.includes(
        vscode.window.activeTextEditor.document.languageId,
      )
    ) {
      this.renderStatus("disabled");
      return;
    }
    // Inline completion is enabled

    if (this.inlineCompletionProvider.isFetching.value) {
      this.renderStatus("loading");
      return;
    }
    // Normal case

    this.renderStatus("ready");
  }

  private renderStatus(
    status: "logged-out" | "disabled" | "ready" | "loading",
  ) {
    switch (status) {
      case "logged-out":
        this.statusBarItem.text = "$(warning) Pochi";
        this.statusBarItem.tooltip = "Click to login.";
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.warningBackground",
        );
        this.statusBarItem.command = "pochi.openLoginPage";
        break;

      case "disabled":
        this.statusBarItem.text = "$(dash) Pochi";
        this.statusBarItem.tooltip =
          "Code completion is disabled. Click to enable.";
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.command = "pochi.inlineCompletion.toggleEnabled";
        break;

      case "ready":
        this.statusBarItem.text = "$(check) Pochi";
        this.statusBarItem.tooltip =
          "Code completion is enabled. Click to disable.";
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.command = "pochi.inlineCompletion.toggleEnabled";
        break;

      case "loading":
        this.statusBarItem.text = "$(loading~spin) Pochi";
        this.statusBarItem.tooltip = "Generating a completion...";
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.command = undefined;
        break;
    }
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}
