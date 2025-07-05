import { getLogger } from "@/lib/logger";
import * as vscode from "vscode";
import { createBackgroundOutputStream } from "./background-stream-utils";
import { OutputManager } from "./output";

const logger = getLogger("TerminalJob");

/**
 * Error class for terminal execution failures
 */
export class ExecutionError extends Error {
  constructor(
    public readonly aborted: boolean,
    message: string,
  ) {
    super(message);
    this.name = "ExecutionError";
  }
}

/**
 * Configuration options for creating a TerminalJob
 */
export interface TerminalJobConfig {
  /** Name of the terminal */
  name: string;
  /** Command to execute in the terminal */
  command: string;
  /** Working directory for the terminal */
  cwd: string;
  /** AbortSignal to cancel the terminal job */
  abortSignal?: AbortSignal;
  /** Background job configuration - detached by default and auto-completes after 5s of no output */
  background?: boolean;
  /** timeout in seconds for the command execution */
  timeout: number;
}

/**
 * A wrapper class around vscode.Terminal that provides enhanced functionality
 * for running commands and managing terminal lifecycle
 */
export class TerminalJob implements vscode.Disposable {
  private readonly terminal: vscode.Terminal;
  private disposables: vscode.Disposable[] = [];
  private shellIntegration: vscode.TerminalShellIntegration | undefined;
  private execution: vscode.TerminalShellExecution | undefined;
  private outputManager = new OutputManager();
  private detached = false;

  get output() {
    return this.outputManager.output;
  }

  detach = () => {
    this.detached = true;
  };

  private constructor(private readonly config: TerminalJobConfig) {
    // For background jobs, detach by default
    if (config.background) {
      this.detached = true;
    }

    // Create the terminal with the provided configuration
    this.terminal = vscode.window.createTerminal({
      name: config.name,
      cwd: config.cwd,
      env: {
        PAGER: "", // Disable pager for better output handling
        GIT_COMMITTER_NAME: "Pochi",
        GIT_COMMITTER_EMAIL: "noreply@getpochi.com",
        GH_PAGER: "",
      },
      iconPath: new vscode.ThemeIcon("piano"),
      hideFromUser: true,
      isTransient: false,
    });

    // Set up event listeners
    this.setupEventListeners();

    this.execute();

    logger.info(
      `Created ${config.background ? "background " : ""}terminal job "${config.name}" with command: ${config.command}`,
    );
  }

  /**
   * Execute the configured command in the terminal
   */
  async execute(): Promise<void> {
    await this.waitForWebviewSubscription();

    let executeError: ExecutionError | undefined = undefined;

    try {
      await this.executeImpl();
    } catch (err) {
      if (err instanceof ExecutionError) {
        executeError = err;
      } else {
        executeError = new ExecutionError(
          false,
          `Command execution failed: ${err}`,
        );
      }
    } finally {
      this.outputManager.finalize(this.detached, executeError);

      if (!this.detached) {
        this.terminal.dispose();
      } else {
        this.terminal.show();
      }

      this.dispose();
    }
  }

  /**
   * Internal implementation of command execution with abort handling
   */
  private async executeImpl(): Promise<void> {
    // Wait for shell integration if not available
    const shellIntegration = await this.waitForShellIntegration();

    this.execution = shellIntegration.executeCommand(this.config.command);
    logger.debug(
      `Executed command in terminal "${this.config.name}": ${this.config.command}`,
    );

    try {
      // Use Promise.race to handle abort signal, timeout, and stream processing
      await Promise.race([
        this.processOutputStream(this.execution.read()),
        this.createAbortAndTimeoutPromise(),
      ]);
    } catch (error) {
      // Re-throw ExecutionError as-is, wrap other errors
      if (error instanceof ExecutionError) {
        throw error;
      }
      throw new ExecutionError(false, `Command execution failed: ${error}`);
    }
  }

  /**
   * Creates a promise that rejects when the abort signal is triggered or timeout is reached
   */
  private createAbortAndTimeoutPromise(): Promise<never> {
    return new Promise<never>((_, reject) => {
      const abortError = new ExecutionError(
        true,
        "Tool execution was aborted by user, please follow the user's guidance for next steps",
      );

      const timeoutError = new ExecutionError(
        false,
        `Command execution timed out after ${this.config.timeout} seconds, if it's used as background task, please consider use isDevServer=true to run it as a dev server.`,
      );

      // Check if already aborted
      if (this.config.abortSignal?.aborted) {
        reject(abortError);
        return;
      }

      // Set up timeout
      const timeoutId = setTimeout(() => {
        logger.info(
          `Command execution timed out after ${this.config.timeout}s: ${this.config.command}`,
        );
        reject(timeoutError);
      }, this.config.timeout * 1000);

      // Set up abort listener
      const abortListener = () => {
        clearTimeout(timeoutId);
        logger.info(`Command execution aborted: ${this.config.command}`);
        reject(abortError);
      };

      this.config.abortSignal?.addEventListener("abort", abortListener, {
        once: true,
      });

      // Clean up timeout if promise chain is resolved elsewhere
      // This is a fallback cleanup mechanism
      const cleanup = () => {
        clearTimeout(timeoutId);
        this.config.abortSignal?.removeEventListener("abort", abortListener);
      };

      // Store cleanup function for potential use in dispose
      this.disposables.push({
        dispose: cleanup,
      });
    });
  }

  /**
   * Processes the output stream and adds lines to the output manager
   */
  private async processOutputStream(
    outputStream: AsyncIterable<string>,
  ): Promise<void> {
    const stream = this.config.background
      ? createBackgroundOutputStream(outputStream)
      : outputStream;
    for await (const chunk of stream) {
      this.outputManager.addChunk(chunk);
    }
  }

  /**
   * Dispose of the terminal and clean up resources
   */
  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];

    logger.debug(`Disposed terminal job "${this.config.name}"`);
  }

  /**
   * Wait for shell integration to become available
   */
  private async waitForShellIntegration(
    timeoutMs = 15000,
  ): Promise<vscode.TerminalShellIntegration> {
    if (this.terminal.shellIntegration) {
      this.shellIntegration = this.terminal.shellIntegration;
      return this.shellIntegration;
    }

    return new Promise<vscode.TerminalShellIntegration>((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        listener.dispose();
        reject(new Error("Timeout waiting for shell integration"));
      }, timeoutMs);

      // Set up event listener for shell integration
      const listener = vscode.window.onDidChangeTerminalShellIntegration(
        ({ terminal, shellIntegration }) => {
          if (terminal === this.terminal) {
            logger.debug("Terminal shell integration acquired");
            this.shellIntegration = shellIntegration;

            // Clean up and resolve
            clearTimeout(timeout);
            listener.dispose();
            resolve(shellIntegration);
          }
        },
      );
    });
  }

  /**
   * Set up event listeners for the terminal
   */
  private setupEventListeners(): void {
    // Listen for terminal close events
    this.disposables.push(
      vscode.window.onDidCloseTerminal((terminal) => {
        if (terminal === this.terminal) {
          this.dispose();
        }
      }),
    );

    // Listen for shell execution success.
    this.disposables.push(
      vscode.window.onDidEndTerminalShellExecution((event) => {
        if (event.execution === this.execution) {
          logger.debug("Terminal shell execution ended", event.exitCode);
        }
      }),
    );
  }

  /**
   * Create a new TerminalJob instance
   */
  static create(config: TerminalJobConfig): TerminalJob {
    return new TerminalJob(config);
  }

  /**
   * Waits for webview subscription to prevent early garbage collection
   */
  private async waitForWebviewSubscription(): Promise<void> {
    await new Promise((resolve) =>
      setTimeout(resolve, WebviewSubscriptionDelayMs),
    );
  }
}

/**
 * Initial delay before starting command execution to ensure webview subscription
 */
const WebviewSubscriptionDelayMs = 250;
