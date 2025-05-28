import { signal } from "@preact/signals-core";
import type { ShellExecutionResult } from "@ragdoll/vscode-webui-bridge";
import { ExecaError, type ResultPromise, execa } from "execa";
import type * as vscode from "vscode";
import { getLogger } from "./logger";

const logger = getLogger("Shell");

const MAX_CONTENT_SIZE = 1_048_576; // 1MB

export class Shell implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  readonly name: string;
  readonly cwd: vscode.Uri;

  constructor(name: string, cwd: vscode.Uri) {
    this.name = name;
    this.cwd = cwd;
  }

  executeCommand(command: string, abortSignal?: AbortSignal): ShellExecution {
    const abortController = new AbortController();
    abortSignal?.addEventListener("abort", () => {
      abortController.abort();
    });
    if (abortSignal?.aborted) {
      abortController.abort();
    }
    logger.info(
      `Executing command in shell "${this.name}" at ${this.cwd.fsPath}: ${command}`,
    );
    const execution = execa(command, {
      cwd: this.cwd.fsPath,
      shell: true,
      all: true,
      cancelSignal: abortController.signal,
      cleanup: true,
    });

    const shellExecution = new ShellExecution(execution, abortController);
    this.disposables.push(shellExecution);
    return shellExecution;
  }

  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}

export class ShellExecution implements vscode.Disposable {
  private isDisposed = false;

  output = signal<ShellExecutionResult>({
    content: "",
    status: "idle",
    isTruncated: false,
  });

  private lines: string[] = [];
  private isTruncated = false;

  constructor(
    private execution: ResultPromise<{
      cwd: string;
      shell: true;
      all: true;
    }>,
    private abortController: AbortController,
  ) {}

  private truncateLines(lines: string[]): {
    lines: string[];
    isTruncated: boolean;
  } {
    const currentLines = [...lines];
    let content = currentLines.join("\n");
    let contentBytes = Buffer.byteLength(content, "utf8");

    if (contentBytes <= MAX_CONTENT_SIZE) {
      return { lines: currentLines, isTruncated: this.isTruncated };
    }

    // Remove lines from the beginning until we're under the limit
    while (contentBytes > MAX_CONTENT_SIZE && currentLines.length > 0) {
      currentLines.shift(); // Remove the first (oldest) line
      content = currentLines.join("\n");
      contentBytes = Buffer.byteLength(content, "utf8");
    }

    return { lines: currentLines, isTruncated: true };
  }

  async read() {
    let isAborted = false;
    let errorMessage: string | undefined;
    try {
      for await (const line of this.execution) {
        this.lines.push(line);

        const { lines: truncatedLines, isTruncated } = this.truncateLines(
          this.lines,
        );

        if (isTruncated && !this.isTruncated) {
          this.isTruncated = true;
          logger.warn(
            `Shell output truncated at ${MAX_CONTENT_SIZE} bytes - removed ${this.lines.length - truncatedLines.length} lines`,
          );
        }

        // Update our lines array to the truncated version
        this.lines = truncatedLines;

        this.output.value = {
          content: this.lines.join("\n"),
          status: "running",
          isTruncated,
        };

        logger.debug(`Shell output: ${line}`);
      }
    } catch (error) {
      // check if the error is due to execa abortion
      if (error instanceof ExecaError) {
        if (error.isCanceled) {
          logger.info("Shell execution aborted by user.");
          isAborted = true;
        } else {
          errorMessage = error.shortMessage;
          logger.error(`Shell execution failed: ${error.message}`);
        }
      } else {
        errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error reading shell output: ${error}`);
      }
    }

    // Final truncation check
    const { lines: finalLines, isTruncated } = this.truncateLines(this.lines);
    this.lines = finalLines;

    this.output.value = {
      content: this.lines.join("\n"),
      status: "completed",
      isTruncated,
      aborted: isAborted
        ? "Tool execution was aborted, the output may be incomplete."
        : undefined,
      error: errorMessage,
    };
  }

  dispose() {
    if (this.isDisposed) return;
    this.abortController.abort();
    this.isDisposed = true;
  }
}
