import { type Signal, signal } from "@preact/signals-core";
import type { ExecuteCommandResult } from "@ragdoll/vscode-webui-bridge";
import { ExecaError, execa } from "execa";
import type * as vscode from "vscode";
import { getLogger } from "./logger";

const logger = getLogger("Shell");

// ========================================
// Constants
// ========================================

/**
 * Maximum content size in bytes before truncation occurs (1MB)
 */
const MaxContentSize = 1_048_576;

/**
 * Initial delay before starting command execution to ensure webview subscription
 */
const WebviewSubscriptionDelayMs = 250;

// ========================================
// Types
// ========================================

/**
 * Configuration for shell execution
 */
interface ShellExecutionConfig {
  command: string;
  cwd: string;
  abortSignal: AbortSignal;
}

/**
 * Result of content truncation operation
 */
interface TruncationResult {
  lines: string[];
  isTruncated: boolean;
}

/**
 * Error information for shell execution
 */
interface ShellExecutionError {
  message: string;
  isCanceled?: boolean;
}

// ========================================
// Utility Classes
// ========================================

/**
 * Handles content truncation logic for shell output
 */
class OutputTruncator {
  private isTruncated = false;

  /**
   * Truncates lines to stay within the maximum content size limit
   */
  truncateLines(lines: string[]): TruncationResult {
    const currentLines = [...lines];
    let content = currentLines.join("\n");
    let contentBytes = Buffer.byteLength(content, "utf8");

    if (contentBytes <= MaxContentSize) {
      return { lines: currentLines, isTruncated: this.isTruncated };
    }

    // Remove lines from the beginning until we're under the limit
    while (contentBytes > MaxContentSize && currentLines.length > 0) {
      currentLines.shift(); // Remove the first (oldest) line
      content = currentLines.join("\n");
      contentBytes = Buffer.byteLength(content, "utf8");
    }

    if (!this.isTruncated) {
      this.isTruncated = true;
      logger.warn(
        `Shell output truncated at ${MaxContentSize} bytes - removed ${lines.length - currentLines.length} lines`,
      );
    }

    return { lines: currentLines, isTruncated: true };
  }

  /**
   * Returns whether content has been truncated
   */
  get hasBeenTruncated(): boolean {
    return this.isTruncated;
  }
}

/**
 * Manages shell output and state updates
 */
class OutputManager {
  public readonly output = signal<ExecuteCommandResult>({
    content: "",
    status: "idle",
    isTruncated: false,
  });

  private lines: string[] = [];
  private truncator = new OutputTruncator();

  /**
   * Adds a new line to the output and updates the signal
   */
  addLine(line: string): void {
    this.lines.push(line);
    this.updateOutput("running");
  }

  /**
   * Finalizes the output with completion status and optional error
   */
  finalize(aborted: boolean, error?: ShellExecutionError): void {
    // Final truncation check
    const { lines: finalLines, isTruncated } = this.truncator.truncateLines(
      this.lines,
    );
    this.lines = finalLines;

    this.output.value = {
      content: this.lines.join("\n"),
      status: "completed",
      isTruncated,
      aborted: aborted
        ? "Tool execution was aborted, the output may be incomplete."
        : undefined,
      error: error?.message,
    };
  }

  /**
   * Updates the output signal with current content and status
   */
  private updateOutput(status: ExecuteCommandResult["status"]): void {
    const { lines: truncatedLines, isTruncated } = this.truncator.truncateLines(
      this.lines,
    );
    this.lines = truncatedLines;

    this.output.value = {
      content: this.lines.join("\n"),
      status,
      isTruncated,
    };
  }
}

/**
 * Handles shell command execution logic
 */
class CommandExecutor {
  constructor(private config: ShellExecutionConfig) {}

  /**
   * Executes the command and yields output lines
   */
  async *executeCommand(): AsyncGenerator<string, void, unknown> {
    // Sleep for a bit to ensure webview have a chance to subscribe
    await this.waitForWebviewSubscription();

    const execution = execa(this.config.command, {
      cwd: this.config.cwd,
      shell: true,
      all: true,
      cancelSignal: this.config.abortSignal,
      cleanup: true,
    });

    try {
      for await (const line of execution) {
        if (this.config.abortSignal.aborted) {
          break;
        }
        yield line;
      }
    } catch (error) {
      throw this.createShellExecutionError(error);
    }
  }

  /**
   * Waits for webview subscription to prevent early garbage collection
   */
  private async waitForWebviewSubscription(): Promise<void> {
    await new Promise((resolve) =>
      setTimeout(resolve, WebviewSubscriptionDelayMs),
    );
  }

  /**
   * Creates a structured error from execution failure
   */
  private createShellExecutionError(error: unknown): ShellExecutionError {
    if (error instanceof ExecaError) {
      if (error.isCanceled) {
        logger.info("Shell execution aborted by user.");
        return {
          message: error.shortMessage,
          isCanceled: true,
        };
      }
      logger.error(`Shell execution failed: ${error.message}`);
      return {
        message: error.shortMessage,
        isCanceled: false,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error reading shell output: ${error}`);
    return {
      message,
      isCanceled: false,
    };
  }
}

// ========================================
// Main Classes
// ========================================

/**
 * Manages shell command execution with output streaming and truncation
 */
class ShellExecution {
  private outputManager = new OutputManager();
  private executor: CommandExecutor;

  constructor(config: ShellExecutionConfig) {
    this.executor = new CommandExecutor(config);
    this.startExecution(config.abortSignal);
  }

  /**
   * Returns the output signal for external consumption
   */
  get output(): Signal<ExecuteCommandResult> {
    return this.outputManager.output;
  }

  /**
   * Starts the command execution process
   */
  private async startExecution(abortSignal: AbortSignal): Promise<void> {
    let executionError: ShellExecutionError | undefined;

    try {
      for await (const line of this.executor.executeCommand()) {
        this.outputManager.addLine(line);

        if (abortSignal.aborted) {
          break;
        }
      }
    } catch (error) {
      if (error instanceof Error && "isCanceled" in error) {
        executionError = error as ShellExecutionError;
      } else {
        executionError = {
          message: error instanceof Error ? error.message : String(error),
          isCanceled: false,
        };
      }
    }

    this.outputManager.finalize(abortSignal.aborted, executionError);
  }
}

/**
 * Main shell interface for executing commands
 */
export class Shell {
  readonly name: string;
  readonly cwd: vscode.Uri;

  constructor(name: string, cwd: vscode.Uri) {
    this.name = name;
    this.cwd = cwd;
  }

  /**
   * Executes a command in this shell and returns a signal with the results
   *
   * @param command - The command to execute
   * @param abortSignal - Optional signal to abort the execution
   * @returns Signal containing the execution result
   */
  executeCommand(
    command: string,
    abortSignal?: AbortSignal,
  ): Signal<ExecuteCommandResult> {
    const abortController = new AbortController();

    // Set up abort signal chaining
    abortSignal?.addEventListener("abort", () => {
      abortController.abort();
    });

    if (abortSignal?.aborted) {
      abortController.abort();
    }

    logger.info(
      `Executing command in shell "${this.name}" at ${this.cwd.fsPath}: ${command}`,
    );

    const execution = new ShellExecution({
      command,
      cwd: this.cwd.fsPath,
      abortSignal: abortController.signal,
    });

    return execution.output;
  }
}
