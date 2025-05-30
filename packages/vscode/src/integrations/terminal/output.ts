import { getLogger } from "@/lib/logger";
import { signal } from "@preact/signals-core";
import type { ExecuteCommandResult } from "@ragdoll/vscode-webui-bridge";
import type { ExecutionError } from "./terminal-job";

const logger = getLogger("TerminalOutput");

/**
 * Maximum content size in bytes before truncation occurs (1MB)
 */
const MaxContentSize = 1_048_576;

/**
 * Result of content truncation operation
 */
interface TruncationResult {
  lines: string[];
  isTruncated: boolean;
}

/**
 * Handles content truncation logic for shell output
 */
export class OutputTruncator {
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

export class OutputManager {
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
  finalize(detached: boolean, error?: ExecutionError): void {
    // Final truncation check
    const { lines: finalLines, isTruncated } = this.truncator.truncateLines(
      this.lines,
    );
    this.lines = finalLines;
    let errorText: string | undefined;

    if (detached) {
      if (error?.aborted) {
        // ignore error as detached job is always aborted
      } else {
        errorText = error?.message;
      }
    } else {
      errorText = error?.message;
    }

    this.output.value = {
      content: this.lines.join(""),
      status: "completed",
      isTruncated,
      detach: detached
        ? "User has detached the terminal, the job will continue running in the background."
        : undefined,
      error: errorText,
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
      content: this.lines.join(""),
      status,
      isTruncated,
    };
  }
}
