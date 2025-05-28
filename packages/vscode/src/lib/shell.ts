import { signal } from "@preact/signals-core";
import type { ShellExecutionResult } from "@ragdoll/vscode-webui-bridge";
import { ExecaError, execa } from "execa";
import type * as vscode from "vscode";
import { getLogger } from "./logger";

const logger = getLogger("Shell");

const MAX_CONTENT_SIZE = 1_048_576; // 1MB

export class Shell {
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

    return new ShellExecution(command, this.cwd.fsPath, abortController.signal);
  }
}

export class ShellExecution {
  output = signal<ShellExecutionResult>({
    content: "",
    status: "idle",
    isTruncated: false,
  });

  private lines: string[] = [];
  private isTruncated = false;

  constructor(
    private command: string,
    private cwd: string,
    private abortSignal: AbortSignal,
  ) {
    this.read();
  }

  private get aborted() {
    return this.abortSignal.aborted;
  }

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

  private async read() {
    // Sleep for a bit to ensure webview have a chance to subscribe it to avoid it being garbage collected too early.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const execution = execa(this.command, {
      cwd: this.cwd,
      shell: true,
      all: true,
      cancelSignal: this.abortSignal,
      cleanup: true,
    });

    let errorMessage: string | undefined;
    try {
      for await (const line of execution) {
        this.lines.push(line);
        if (this.aborted) break;

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
      }
    } catch (error) {
      // check if the error is due to execa abortion
      if (error instanceof ExecaError) {
        if (error.isCanceled) {
          logger.info("Shell execution aborted by user.");
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
      aborted: this.aborted
        ? "Tool execution was aborted, the output may be incomplete."
        : undefined,
      error: errorMessage,
    };
  }
}
