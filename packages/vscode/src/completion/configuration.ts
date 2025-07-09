import { EventEmitter } from "node:events";
import { injectable, singleton } from "tsyringe";
import * as vscode from "vscode";
import { getLogger } from "../lib/logger";
// biome-ignore lint/style/useImportType: needed for initialization
import { TokenStorage } from "../lib/token-storage";
import { type CompletionConfig, DefaultCompletionConfig } from "./types";

@injectable()
@singleton()
export class CompletionConfiguration
  extends EventEmitter
  implements vscode.Disposable
{
  private logger = getLogger("CompletionConfig");
  private disposables: vscode.Disposable[] = [];
  private tokenUnsubscribe?: () => void;
  private tokenUpdateTimeout?: ReturnType<typeof setTimeout>;

  constructor(private tokenStorage: TokenStorage) {
    super();

    // Listen for configuration changes
    const configDisposable = vscode.workspace.onDidChangeConfiguration(
      async (event) => {
        if (
          event.affectsConfiguration("pochi.inlineCompletion") ||
          event.affectsConfiguration("pochi.settings.advanced")
        ) {
          this.logger.debug("Configuration changed, emitting update event");
          this.emit("updated", this.getConfig());
        }
      },
    );
    this.disposables.push(configDisposable);

    // Listen for token changes with debouncing
    this.tokenUnsubscribe = this.tokenStorage.token.subscribe(() => {
      if (this.tokenUpdateTimeout) {
        clearTimeout(this.tokenUpdateTimeout);
      }
      this.tokenUpdateTimeout = setTimeout(() => {
        this.logger.debug("Token changed, emitting update event");
        this.emit("updated", this.getConfig());
      }, 100);
    });
  }

  getConfig(): CompletionConfig {
    const config = vscode.workspace.getConfiguration("pochi");

    // Get the nested inlineCompletion object with defaults
    const inlineCompletionConfig = config.get(
      "inlineCompletion",
      DefaultCompletionConfig,
    );
    // Ensure all required properties exist with defaults
    const userConfig: CompletionConfig = {
      ...DefaultCompletionConfig,
      ...inlineCompletionConfig,
    };

    return userConfig;
  }

  // Getter methods for convenience
  get enabled(): boolean {
    // TODO(sma1lboy): Remove the advanced setting check after tab completion is not experimental feature anymore
    const advancedConfig = vscode.workspace.getConfiguration(
      "pochi.settings.advanced",
    );
    const showInlineCompletionUI = advancedConfig.get(
      "inlineCompletion",
      false,
    );

    return this.getConfig().enabled && showInlineCompletionUI;
  }

  get triggerMode(): "automatic" | "manual" {
    return this.getConfig().triggerMode;
  }

  get disabledLanguages(): string[] {
    return this.getConfig().disabledLanguages;
  }

  get serverConfig(): { baseUrl: string; apiKey: string } {
    // Deprecated - kept for backward compatibility
    return {
      baseUrl: "",
      apiKey: "",
    };
  }

  // Validation methods
  isConfigured(): boolean {
    // Just check if we have a token since ApiClient handles the rest
    const hasToken = !!this.tokenStorage.token.value;
    this.logger.debug("Completion configuration check:", {
      hasToken,
      tokenLength: this.tokenStorage.token.value?.length || 0,
      tokenPreview: this.tokenStorage.token.value
        ? `${this.tokenStorage.token.value.substring(0, 10)}...`
        : "null",
    });
    return hasToken;
  }

  getConfigurationIssues(): string[] {
    const config = this.getConfig();
    const issues: string[] = [];

    if (!this.tokenStorage.token.value) {
      issues.push("Authentication token is not available");
    }

    if (config.temperature < 0 || config.temperature > 1) {
      issues.push("Temperature must be between 0 and 1");
    }

    if (config.maxPrefixLines < 1) {
      issues.push("Max prefix lines must be at least 1");
    }

    if (config.maxSuffixLines < 0) {
      issues.push("Max suffix lines must be non-negative");
    }

    if (config.debounceDelay < 0) {
      issues.push("Debounce delay must be non-negative");
    }

    return issues;
  }

  // Helper method to toggle completion
  async toggleEnabled(): Promise<void> {
    const config = vscode.workspace.getConfiguration("pochi");
    const currentConfig = config.get(
      "inlineCompletion",
      DefaultCompletionConfig,
    );
    const currentValue = currentConfig.enabled;

    // Update the entire inlineCompletion object with the toggled enabled value
    const updatedConfig = {
      ...currentConfig,
      enabled: !currentValue,
    };

    await config.update(
      "inlineCompletion",
      updatedConfig,
      vscode.ConfigurationTarget.Global,
    );

    this.logger.debug(
      `Code completion ${!currentValue ? "enabled" : "disabled"}`,
    );
  }

  // Helper method to reset to default configuration
  async resetToDefaults(): Promise<void> {
    const config = vscode.workspace.getConfiguration("pochi");

    // Reset the entire inlineCompletion object to defaults
    await config.update(
      "inlineCompletion",
      DefaultCompletionConfig,
      vscode.ConfigurationTarget.Global,
    );

    this.logger.info("Reset completion configuration to defaults");
  }

  // Helper method to open settings
  async openSettings(): Promise<void> {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "pochi",
    );
  }

  // Cleanup method
  dispose(): void {
    // Clear any pending timeout
    if (this.tokenUpdateTimeout) {
      clearTimeout(this.tokenUpdateTimeout);
      this.tokenUpdateTimeout = undefined;
    }

    // Unsubscribe from token changes
    if (this.tokenUnsubscribe) {
      this.tokenUnsubscribe();
      this.tokenUnsubscribe = undefined;
    }

    // Dispose all VS Code disposables
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];

    // Remove all event listeners
    this.removeAllListeners();
  }
}
