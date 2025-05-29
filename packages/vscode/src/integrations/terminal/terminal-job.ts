import { getLogger } from "@/lib/logger";
import * as vscode from "vscode";
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
}

/**
 * A wrapper class around vscode.Terminal that provides enhanced functionality
 * for running commands and managing terminal lifecycle
 */
export class TerminalJob implements vscode.Disposable {
  private readonly terminal: vscode.Terminal;
  private disposables: vscode.Disposable[] = [];
  private shellIntegration: vscode.TerminalShellIntegration | undefined;
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

    const execution = shellIntegration.executeCommand(this.config.command);
    logger.debug(
      `Executed command in terminal "${this.config.name}": ${this.config.command}`,
    );

    try {
      // Use Promise.race to handle abort signal alongside stream processing
      await Promise.race([
        this.processOutputStream(execution.read()),
        this.createAbortPromise(),
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
   * Creates a promise that rejects when the abort signal is triggered
   */
  private createAbortPromise(): Promise<never> {
    return new Promise<never>((_, reject) => {
      const abortError = new ExecutionError(
        true,
        "Tool execution was aborted by user, please follow the user's guidance for next steps",
      );

      if (this.config.abortSignal?.aborted) {
        reject(abortError);
        return;
      }

      const abortListener = () => {
        logger.info(`Command execution aborted: ${this.config.command}`);
        reject(abortError);
      };

      this.config.abortSignal?.addEventListener("abort", abortListener, {
        once: true,
      });
    });
  }

  /**
   * Processes the output stream and adds lines to the output manager
   */
  private async processOutputStream(
    outputStream: AsyncIterable<string>,
  ): Promise<void> {
    if (this.config.background) {
      await this.processBackgroundOutputStream(outputStream);
    } else {
      for await (const line of outputStream) {
        this.outputManager.addLine(line);
      }
    }
  }

  /**
   * Processes output stream for background jobs with auto-completion after 5s of no output
   */
  private async processBackgroundOutputStream(
    outputStream: AsyncIterable<string>,
  ): Promise<void> {
    const NoOutputTimeoutMs = 5000; // 5 seconds

    return new Promise<void>((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let isCompleted = false;

      const complete = () => {
        if (isCompleted) return;
        isCompleted = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        logger.info(
          `Background job "${this.config.name}" auto-completed after ${NoOutputTimeoutMs}ms of no output`,
        );
        resolve();
      };

      const resetTimeout = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(complete, NoOutputTimeoutMs);
      };

      // Start initial timeout
      resetTimeout();

      // Process the output stream
      const processOutput = async () => {
        try {
          for await (const line of outputStream) {
            if (isCompleted) break;

            this.outputManager.addLine(line);
            resetTimeout(); // Reset timeout on each new line
          }

          // If the stream ends naturally, complete immediately
          complete();
        } catch (error) {
          if (isCompleted) return;
          isCompleted = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          reject(error);
        }
      };

      // Start processing
      processOutput();
    });
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
    timeoutMs = 5000,
  ): Promise<vscode.TerminalShellIntegration> {
    if (this.terminal.shellIntegration) {
      this.shellIntegration = this.terminal.shellIntegration;
      return this.shellIntegration;
    }

    await new Promise((resolve) => setTimeout(resolve, timeoutMs));
    if (!this.shellIntegration) {
      throw new Error("Timeout waiting for shell integration");
    }

    return this.shellIntegration;
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

    // Listen for shell integration changes
    this.disposables.push(
      vscode.window.onDidChangeTerminalShellIntegration(
        ({ terminal, shellIntegration }) => {
          if (terminal === this.terminal) {
            this.shellIntegration = shellIntegration;
          }
        },
      ),
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
