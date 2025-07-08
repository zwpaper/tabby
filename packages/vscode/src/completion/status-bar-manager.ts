import { inject, injectable, singleton } from "tsyringe";
import * as vscode from "vscode";
import { getLogger } from "../lib/logger";
// biome-ignore lint/style/useImportType: needed for initialization
import { TokenStorage } from "../lib/token-storage";
import { CompletionConfiguration } from "./configuration";

export type CompletionStatus =
  | "inactive" // No token or not configured
  | "disabled" // Completion disabled by user
  | "ready" // Ready to complete
  | "loading" // Request in progress
  | "success" // Recent successful completion
  | "error"; // Recent error

@injectable()
@singleton()
export class CompletionStatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private logger = getLogger("CompletionStatusBarManager");
  private currentStatus: CompletionStatus = "inactive";
  private statusTimeout?: ReturnType<typeof setTimeout>;

  constructor(
    private tokenStorage: TokenStorage,
    @inject(CompletionConfiguration)
    private completionConfig: CompletionConfiguration,
  ) {
    this.logger.info("StatusBarManager constructor called", {
      hasConfig: !!this.completionConfig,
      configEnabled: this.completionConfig.enabled,
    });

    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );

    // Update status initially
    this.updateStatus();

    // Listen for token changes
    this.tokenStorage.token.subscribe(() => {
      this.updateStatus();
    });

    // Listen for configuration changes
    this.completionConfig.on("updated", (config) => {
      this.logger.info("Configuration updated, updating status bar", {
        enabled: config.enabled,
      });
      this.updateStatus(config);
    });

    // Show the status bar item
    this.statusBarItem.show();
  }

  private updateStatus(configOverride?: { enabled: boolean }): void {
    const hasToken = !!this.tokenStorage.token.value;
    const isEnabled = configOverride
      ? configOverride.enabled
      : this.completionConfig.enabled;

    this.logger.info("Updating status bar:", {
      hasToken,
      currentStatus: this.currentStatus,
      isEnabled,
    });

    if (!isEnabled) {
      this.setStatus("disabled");
      return;
    }

    if (!hasToken) {
      this.setStatus("inactive");
      return;
    }

    // If we have a token and completion is enabled, set to ready
    if (
      this.currentStatus === "inactive" ||
      this.currentStatus === "disabled"
    ) {
      this.setStatus("ready");
    }
  }

  private setStatus(status: CompletionStatus): void {
    this.currentStatus = status;
    this.renderStatus();

    // Auto-reset temporary states
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
    }

    if (status === "success" || status === "error") {
      this.statusTimeout = setTimeout(() => {
        this.setStatus("ready");
      }, 2000); // Show success/error for 2 seconds
    }
  }

  private renderStatus(): void {
    this.logger.debug("Rendering status bar:", {
      status: this.currentStatus,
      text: this.statusBarItem.text,
      tooltip: this.statusBarItem.tooltip,
      command: this.statusBarItem.command,
      backgroundColor: this.statusBarItem.backgroundColor,
    });
    switch (this.currentStatus) {
      case "inactive":
        this.statusBarItem.text = "$(warning) Pochi";
        this.statusBarItem.tooltip =
          "Code completion requires authentication. Click to log in.";
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
        this.statusBarItem.command = "pochi.completion.toggle";
        break;

      case "ready":
        this.statusBarItem.text = "$(check) Pochi";
        this.statusBarItem.tooltip =
          "Code completion is enabled. Click to disable.";
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.command = "pochi.completion.toggle";
        break;

      case "loading":
        this.statusBarItem.text = "$(loading~spin) Pochi";
        this.statusBarItem.tooltip = "Pochi is generating a completion...";
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.command = undefined;
        break;

      case "success":
        this.statusBarItem.text = "$(check) Pochi";
        this.statusBarItem.tooltip = "Completion successful. Click to disable.";
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.prominentBackground",
        );
        this.statusBarItem.command = "pochi.completion.toggle";
        break;

      case "error":
        this.statusBarItem.text = "$(error) Pochi";
        this.statusBarItem.tooltip = "Completion failed. Click to disable.";
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.errorBackground",
        );
        this.statusBarItem.command = "pochi.completion.toggle";
        break;
    }
  }

  // Public methods to control status
  public showLoading(): void {
    this.setStatus("loading");
  }

  public showSuccess(): void {
    this.setStatus("success");
  }

  public showError(): void {
    this.setStatus("error");
  }

  public showReady(): void {
    this.setStatus("ready");
  }

  dispose(): void {
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
    }
    this.statusBarItem.dispose();
  }
}
