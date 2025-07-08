import { EventEmitter } from "node:events";
import { getLogger } from "@ragdoll/common";
import * as vscode from "vscode";
import type { ApiClient } from "../lib/auth-client";
import { CompletionCache } from "./cache";
// biome-ignore lint/style/useImportType: needed for initialization
import { CompletionConfiguration } from "./configuration";
import { ContextBuilder } from "./context-builder";
import { Debouncer } from "./debouncer";
import { PostProcessor } from "./post-processor";
// biome-ignore lint/style/useImportType: needed for initialization
import { CompletionStatusBarManager } from "./status-bar-manager";
import type {
  CompletionContext,
  CompletionEvent,
  CompletionExtraContexts,
  CompletionRequest,
  CompletionResponse,
  CompletionResultItem,
  DisplayedCompletion,
} from "./types";
import { CompletionError } from "./types";

const logger = getLogger("RagdollInlineCompletionProvider");
export class InlineCompletionProvider
  extends EventEmitter
  implements vscode.InlineCompletionItemProvider
{
  private displayedCompletion: DisplayedCompletion | null = null;
  private ongoing: Promise<vscode.InlineCompletionItem[] | null> | null = null;
  private disposables: vscode.Disposable[] = [];

  private readonly contextBuilder: ContextBuilder;
  private readonly postProcessor: PostProcessor;
  private readonly cache: CompletionCache;
  private readonly debouncer: Debouncer;

  constructor(
    private readonly apiClient: ApiClient,
    private readonly configManager: CompletionConfiguration,
    private readonly statusBarManager: CompletionStatusBarManager,
  ) {
    super();

    const config = this.configManager.getConfig();
    this.contextBuilder = new ContextBuilder();
    this.postProcessor = new PostProcessor();
    this.cache = new CompletionCache(config.cacheSize, config.cacheTTL);
    this.debouncer = new Debouncer();

    // Set up internal event handlers for status bar updates
    this.setupStatusBarHandlers();
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[] | null> {
    try {
      // 1. Check if completion is enabled
      if (!this.configManager.enabled) {
        return null;
      }

      // 2. Check if completion should be triggered
      if (!this.shouldTrigger(context, document)) {
        return null;
      }

      // 3. Validate configuration (now handled by ApiClient/TokenStorage)
      // No need for separate validation since ApiClient handles authentication

      // 4. Build completion context
      const completionContext = this.contextBuilder.buildCompletionContext(
        document,
        position,
        context,
      );

      // 4. Check cache first
      const cacheKey = this.cache.generateKey(completionContext, {});
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return this.createInlineCompletionItems(cached, completionContext);
      }

      // 5. Debounce for automatic triggers
      const isManual =
        context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke;
      if (!isManual) {
        await this.debouncer.debounce({
          triggerCharacter: this.getLastCharacter(
            completionContext.currentLinePrefix,
          ),
          isLineEnd: completionContext.isLineEnd,
          isDocumentEnd: completionContext.suffix.trim() === "",
          manually: false,
        });
      }

      // 6. Check if request was cancelled during debounce
      if (token.isCancellationRequested) {
        return null;
      }

      // 7. If there's an ongoing request, wait for it or cancel it
      if (this.ongoing) {
        try {
          return await this.ongoing;
        } catch {
          // If ongoing request failed, continue with new request
        }
      }

      // 8. Start new completion request
      this.ongoing = this.fetchCompletion(completionContext, isManual, token);
      this.emit("loadingChanged", true);

      const result = await this.ongoing;
      this.ongoing = null;
      this.emit("loadingChanged", false);

      return result;
    } catch (error) {
      this.ongoing = null;
      this.emit("loadingChanged", false);

      logger.error("Completion error:", error);

      // Don't show errors for cancelled requests
      if (token.isCancellationRequested) {
        return null;
      }

      // Emit error event for status bar
      this.emit("completionError", error);

      // Show user-friendly error messages
      if (error instanceof CompletionError) {
        this.showCompletionError(error);
      }

      return null;
    }
  }

  private async fetchCompletion(
    context: CompletionContext,
    isManual: boolean,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[] | null> {
    // Fetch extra context
    const extraContexts = await this.contextBuilder.fetchExtraContext(
      context,
      isManual,
    );

    // Build completion request
    const request = this.buildCompletionRequest(context, extraContexts);

    // Pre-process (quick filters)
    const preProcessedChoices = this.postProcessor.process(
      [{ index: 0, text: request.segments.prefix }],
      context,
      "pre",
    );
    if (preProcessedChoices.length === 0) {
      return null;
    }

    // Fetch completion from server using ApiClient
    const response = await this.fetchCompletionFromAPI(request, token);

    // Post-process completion
    const processedItems = this.postProcessor.process(
      response.choices,
      context,
      "post",
    );

    if (processedItems.length === 0) {
      return null;
    }

    // Cache result
    const cacheKey = this.cache.generateKey(context, extraContexts);
    this.cache.set(cacheKey, processedItems);

    // Create VSCode completion items
    const completionItems = this.createInlineCompletionItems(
      processedItems,
      context,
    );

    // Track displayed completion
    if (completionItems && completionItems.length > 0) {
      this.displayedCompletion = {
        id: `view-${response.id}-at-${Date.now()}`,
        completions: response,
        index: 0,
        displayedAt: Date.now(),
      };

      this.emitEvent({ type: "show", completion: this.displayedCompletion });
    }

    return completionItems;
  }

  private async fetchCompletionFromAPI(
    request: CompletionRequest,
    token: vscode.CancellationToken,
  ): Promise<CompletionResponse> {
    try {
      const startTime = Date.now();
      const response = await this.apiClient.api.code.completion.$post({
        json: request,
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");

        switch (response.status) {
          case 401:
            throw new CompletionError(
              "Authentication failed. Please log in.",
              "AUTHENTICATION_ERROR",
              401,
            );
          case 403:
            throw new CompletionError(
              "Access denied. Please check your permissions or waitlist status.",
              "AUTHORIZATION_ERROR",
              403,
            );
          case 429:
            throw new CompletionError(
              "Rate limit exceeded. Please try again later.",
              "RATE_LIMIT_ERROR",
              429,
            );
          case 500:
            throw new CompletionError(
              "Server error. Please try again later.",
              "SERVER_ERROR",
              500,
            );
          default:
            throw new CompletionError(
              `HTTP ${response.status}: ${errorText}`,
              "HTTP_ERROR",
              response.status,
            );
        }
      }

      const result = (await response.json()) as CompletionResponse;

      // Validate response format
      if (!result.id || !Array.isArray(result.choices)) {
        throw new CompletionError(
          "Invalid response format from server",
          "INVALID_RESPONSE",
        );
      }

      logger.debug(`Completion completed in ${duration}ms`, {
        requestId: result.id,
        choicesCount: result.choices.length,
        prefixLength: request.segments.prefix.length,
        suffixLength: request.segments.suffix?.length || 0,
      });

      return result;
    } catch (error) {
      // Handle network errors
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new CompletionError(
          "Network error. Please check your connection.",
          "NETWORK_ERROR",
        );
      }

      // Handle cancellation
      if (token.isCancellationRequested) {
        throw new CompletionError("Request was cancelled.", "CANCELLED");
      }

      // Re-throw CompletionError as-is
      if (error instanceof CompletionError) {
        throw error;
      }

      // Wrap other errors
      throw new CompletionError(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        "UNKNOWN_ERROR",
      );
    }
  }

  private shouldTrigger(
    context: vscode.InlineCompletionContext,
    document: vscode.TextDocument,
  ): boolean {
    const config = this.configManager.getConfig();

    // Skip if completion is disabled
    if (!config.enabled) {
      return false;
    }

    // Skip for disabled languages
    if (config.disabledLanguages.includes(document.languageId)) {
      return false;
    }

    // Skip automatic triggers when in manual mode
    if (
      context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic &&
      config.triggerMode === "manual"
    ) {
      return false;
    }

    // Skip when text is selected during automatic trigger
    if (
      context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic &&
      vscode.window.activeTextEditor &&
      !vscode.window.activeTextEditor.selection.isEmpty
    ) {
      return false;
    }

    return true;
  }

  private buildCompletionRequest(
    context: CompletionContext,
    extraContexts: CompletionExtraContexts,
  ): CompletionRequest {
    const relativePath = vscode.workspace.asRelativePath(context.document.uri);

    return {
      language: context.document.languageId,
      segments: {
        prefix: context.prefix,
        suffix: context.suffix || undefined,
        filepath: relativePath,
        git_url: extraContexts.git?.url,
        declarations: extraContexts.declarations,
        relevant_snippets_from_changed_files:
          extraContexts.recentlyChangedFiles,
        relevant_snippets_from_recently_opened_files:
          extraContexts.recentlyOpenedFiles,
      },
      temperature: this.configManager.getConfig().temperature,
      mode: "standard",
    };
  }

  private createInlineCompletionItems(
    items: CompletionResultItem[],
    _context: CompletionContext,
  ): vscode.InlineCompletionItem[] {
    return items.map((item, index) => {
      const completionItem = new vscode.InlineCompletionItem(
        item.text,
        item.range,
      );

      // Add command to handle acceptance
      completionItem.command = {
        title: "",
        command: "pochi.completion.accept",
        arguments: [() => this.handleAccept(index)],
      };

      return completionItem;
    });
  }

  private handleAccept(index = 0): void {
    if (this.displayedCompletion) {
      this.displayedCompletion.index = index;
      this.emitEvent({
        type: "accept",
        completion: this.displayedCompletion,
        index,
      });
      this.displayedCompletion = null;
    }
  }

  handleDismiss(): void {
    if (this.displayedCompletion) {
      this.emitEvent({ type: "dismiss", completion: this.displayedCompletion });
      this.displayedCompletion = null;
    }
  }

  private emitEvent(event: CompletionEvent): void {
    this.emit("completionEvent", event);

    // Log event for analytics/debugging
    logger.debug("Completion event:", event.type, {
      completionId: event.completion.id,
      displayTime: Date.now() - event.completion.displayedAt,
      choicesCount: event.completion.completions.choices.length,
    });
  }

  private getLastCharacter(text: string): string {
    return text.length > 0 ? text[text.length - 1] : "";
  }

  private showCompletionError(error: CompletionError): void {
    let message = `Completion failed: ${error.message}`;
    const actions: string[] = [];

    switch (error.code) {
      case "AUTHENTICATION_ERROR":
      case "MISSING_API_KEY":
        message = "Authentication required for completions";
        actions.push("Sign In");
        break;
      case "AUTHORIZATION_ERROR":
        message =
          "Access denied. Please check your permissions or sign in again.";
        actions.push("Sign In");
        break;
      case "NETWORK_ERROR":
        actions.push("Retry");
        break;
      case "RATE_LIMIT_ERROR":
        message = "Rate limit exceeded. Please try again in a moment.";
        break;
      default:
        // Don't show generic errors to avoid spam
        return;
    }

    vscode.window.showWarningMessage(message, ...actions).then((selection) => {
      switch (selection) {
        case "Sign In":
          vscode.commands.executeCommand("pochi.openLoginPage");
          break;
        case "Retry":
          // Could implement retry logic here
          break;
      }
    });
  }

  private setupStatusBarHandlers(): void {
    // Handle completion events for analytics/logging and status bar updates
    this.on("completionEvent", (event: CompletionEvent) => {
      logger.debug("Completion event:", event);

      // Update status bar based on completion events
      switch (event.type) {
        case "accept":
          this.statusBarManager.showSuccess();
          break;
        case "show":
          // Completion successfully generated and shown
          this.statusBarManager.showSuccess();
          break;
        case "dismiss":
          // Reset to ready state when completion is dismissed
          this.statusBarManager.showReady();
          break;
      }
    });

    // Handle loading state changes - connect to status bar
    this.on("loadingChanged", (isLoading: boolean) => {
      logger.debug("Completion loading:", isLoading);

      if (isLoading) {
        this.statusBarManager.showLoading();
      } else {
        // Don't automatically show ready here, let completion events handle success/error
        // If no completion event follows, the auto-reset will handle it
      }
    });

    // Handle completion errors - show error status
    this.on("completionError", (error: Error) => {
      logger.error("Completion error:", error);
      this.statusBarManager.showError();
    });

    // Listen for text editor changes to dismiss completions
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(() => {
        this.handleDismiss();
      }),
    );
  }

  // Cleanup method
  dispose(): void {
    // Dispose VS Code disposables
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];

    // Clean up event listeners and cache
    this.removeAllListeners();
    this.cache.clear();
  }
}
