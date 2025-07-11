import { EventEmitter } from "node:events";
import { getLogger } from "@ragdoll/common";
import { inject, injectable } from "tsyringe";
import * as vscode from "vscode";
import type { ApiClient } from "../lib/auth-client";
import { CompletionCache, calculateCompletionContextHash } from "./cache";
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
const MaxCompletionInterval = 5000;
@injectable()
export class InlineCompletionProvider
  extends EventEmitter
  implements vscode.InlineCompletionItemProvider
{
  private displayedCompletion: DisplayedCompletion | null = null;
  private ongoing: Promise<vscode.InlineCompletionItem[] | null> | null = null;
  private disposables: vscode.Disposable[] = [];
  private abortController: AbortController | null = null;

  private readonly contextBuilder: ContextBuilder;
  private readonly postProcessor: PostProcessor;
  private cache: CompletionCache;
  private readonly debouncer: Debouncer;
  private providerDisposable: vscode.Disposable | null = null;

  constructor(
    @inject("ApiClient") private readonly apiClient: ApiClient,
    private readonly configManager: CompletionConfiguration,
    private readonly statusBarManager: CompletionStatusBarManager,
  ) {
    super();

    this.contextBuilder = new ContextBuilder();
    this.postProcessor = new PostProcessor();
    this.cache = new CompletionCache(); // Use default cache settings
    this.debouncer = new Debouncer();

    // Set up internal event handlers for status bar updates
    this.setupStatusBarHandlers();

    // Register with VSCode - we'll check config in provideInlineCompletionItems
    this.registerProvider();
  }

  private registerProvider(): void {
    this.providerDisposable =
      vscode.languages.registerInlineCompletionItemProvider(
        { pattern: "**" }, // All files
        this,
      );
    logger.debug("Inline completion provider registered with VSCode");
  }

  private unregisterProvider(): void {
    if (this.providerDisposable) {
      this.providerDisposable.dispose();
      this.providerDisposable = null;
      logger.debug("Inline completion provider unregistered from VSCode");
    }
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[] | null> {
    try {
      if (!this.configManager.enabled) {
        return null;
      }

      if (!this.shouldTrigger(context, document)) {
        return null;
      }

      const completionContext = this.contextBuilder.buildCompletionContext(
        document,
        position,
        context,
      );

      // 4. Determine if this is a manual trigger
      const isManual =
        context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke;

      // 5. Fetch extra context first for proper cache key generation
      const extraContexts = await this.contextBuilder.fetchExtraContext(
        completionContext,
        isManual,
      );

      // 6. Check cache with complete context
      const cacheKey = calculateCompletionContextHash(
        completionContext,
        extraContexts,
      );
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.debug("Cache hit for completion", { cacheKey });
        return this.createInlineCompletionItems(cached, completionContext);
      }

      // 7. Debounce for automatic triggers
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

      // 7. Check if request was cancelled during debounce
      if (token.isCancellationRequested) {
        return null;
      }

      // 8. Cancel any ongoing request
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }

      // 9. Create new AbortController for this request
      this.abortController = new AbortController();
      const currentAbortController = this.abortController;

      // 10. Start new completion request with pre-fetched context
      this.ongoing = this.fetchCompletion(
        completionContext,
        extraContexts,
        cacheKey,
        token,
        currentAbortController.signal,
      );
      this.emit("loadingChanged", true);

      try {
        const result = await this.ongoing;

        // Verify this request wasn't cancelled
        if (currentAbortController.signal.aborted) {
          logger.debug("Ignoring completion response from aborted request");
          return null;
        }

        // If no result, update status bar to show ready state
        if (!result || result.length === 0) {
          this.statusBarManager.showReady();
        }

        return result;
      } finally {
        // Only clear if this is still the current request
        if (this.abortController === currentAbortController) {
          this.ongoing = null;
          this.emit("loadingChanged", false);
        }
      }
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
    extraContexts: CompletionExtraContexts,
    cacheKey: string,
    token: vscode.CancellationToken,
    abortSignal: AbortSignal,
  ): Promise<vscode.InlineCompletionItem[] | null> {
    // Build completion request
    const request = this.buildCompletionRequest(context, extraContexts);

    // Check if request was already cancelled
    if (abortSignal.aborted) {
      logger.debug("Request cancelled before API call");
      return null;
    }

    logger.trace("before completion request", {
      request,
      context,
      extraContexts,
    });
    // Fetch completion from server using ApiClient
    try {
      const response = await this.fetchCompletionFromAPI(
        request,
        token,
        abortSignal,
      );

      logger.trace("completion response", {
        response,
        context,
        extraContexts,
      });

      // If response is null (due to abort), return null
      if (!response) {
        return null;
      }

      const completionItems = response.choices.map((choice) =>
        this.postProcessor.toCompletionResultItem(choice, context),
      );

      // Pre-cache process
      const preCacheProcessedItems = this.postProcessor.process(
        completionItems,
        context,
        "preCache",
      );

      logger.trace("pre-cache processed", {
        preCacheProcessedItems,
        context,
        extraContexts,
      });

      // Verify this request wasn't cancelled after API call
      if (abortSignal.aborted) {
        logger.debug("Ignoring response from aborted request");
        return null;
      }

      // Cache result
      this.cache.set(cacheKey, preCacheProcessedItems);

      logger.trace("Cached completion result", {
        cacheKey,
        itemCount: preCacheProcessedItems.length,
      });

      if (preCacheProcessedItems.length === 0) {
        return null;
      }

      // Post-cache process completion
      const postCacheProcessedItems = this.postProcessor.process(
        preCacheProcessedItems,
        context,
        "postCache",
      );

      logger.trace("post-cache processed", {
        postCacheProcessedItems,
        context,
        extraContexts,
      });

      // Create VSCode completion items
      const vscodeInlineCompletionItems = this.createInlineCompletionItems(
        postCacheProcessedItems,
        context,
      );

      logger.trace("vscode inline completion items", {
        vscodeInlineCompletionItems,
        context,
        extraContexts,
      });

      // Track displayed completion
      if (
        vscodeInlineCompletionItems &&
        vscodeInlineCompletionItems.length > 0
      ) {
        this.displayedCompletion = {
          id: `view-${response.id}-at-${Date.now()}`,
          completions: response,
          index: 0,
          displayedAt: Date.now(),
        };

        this.emitEvent({ type: "show", completion: this.displayedCompletion });
      }

      return vscodeInlineCompletionItems;
    } catch (error) {
      // Handle abort/cancellation - this is expected behavior, just return null
      if (error instanceof Error && error.name === "AbortError") {
        logger.debug("Request was aborted during fetchCompletion");
        return null;
      }

      // Re-throw other errors to be handled by the main error handler
      throw error;
    }
  }

  private async fetchCompletionFromAPI(
    request: CompletionRequest,
    token: vscode.CancellationToken,
    abortSignal: AbortSignal,
  ): Promise<CompletionResponse | null> {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, MaxCompletionInterval);

    try {
      const startTime = Date.now();

      const combinedSignal = AbortSignal.any([
        abortSignal,
        timeoutController.signal,
      ]);

      const response = await this.apiClient.api.code.completion.$post(
        {
          json: request,
        },
        {
          init: {
            signal: combinedSignal,
          },
        },
      );

      clearTimeout(timeoutId);

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

      const result = await response.json();

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
        prefixLength: request.segments.prefix?.length,
        suffixLength: request.segments.suffix?.length,
      });

      return result;
    } catch (error: unknown) {
      // Handle abort/cancellation - this is expected behavior, just return null
      if (error instanceof Error && error.name === "AbortError") {
        if (timeoutController.signal.aborted) {
          logger.trace("Request timeout occurred");
          this.statusBarManager.showError();
          return null;
        }
        logger.debug("Request was aborted");
        return null;
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new CompletionError(
          "Network error. Please check your connection.",
          "NETWORK_ERROR",
        );
      }

      // Handle cancellation
      if (token.isCancellationRequested) {
        return null;
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
    } finally {
      // Always clear the timeout
      clearTimeout(timeoutId);
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
        gitUrl: extraContexts.git?.url,
        declarations: extraContexts.declarations,
        relevantSnippetsFromChangedFiles: extraContexts.recentlyChangedFiles,
        relevantSnippetsFromRecentlyOpenedFiles:
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
          // TODO(sma1lboy): adding logic here
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

      // Listen for document changes to dismiss completions when user types
      vscode.workspace.onDidChangeTextDocument((event) => {
        const activeEditor = vscode.window.activeTextEditor;
        if (
          activeEditor &&
          event.document === activeEditor.document &&
          this.displayedCompletion
        ) {
          for (const change of event.contentChanges) {
            if (change.text.length > 0 && change.rangeLength === 0) {
              const char = change.text;
              if (
                char === " " ||
                char === "\n" ||
                char === "\r" ||
                char === "\t"
              ) {
                logger.debug(
                  "Dismissing completion due to breaking character:",
                  JSON.stringify(char),
                );
                this.handleDismiss();
                break;
              }
            }
          }
        }
      }),
    );
  }

  // Cleanup method
  dispose(): void {
    // Unregister from VSCode
    this.unregisterProvider();

    // Cancel any ongoing requests
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

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
