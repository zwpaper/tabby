import { getLogger } from "@/lib/logger";
import { signal } from "@preact/signals-core";
import { MaxTerminalOutputSize } from "@ragdoll/common/node";
import type { ExecuteCommandResult } from "@ragdoll/vscode-webui-bridge";
import type { ExecutionError } from "./terminal-job";

const logger = getLogger("TerminalOutput");

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

    // Calculate initial content size using the same separator as joinContent
    let contentBytes = this.calculateContentBytes(currentLines);

    if (contentBytes <= MaxTerminalOutputSize) {
      return { lines: currentLines, isTruncated: this.isTruncated };
    }

    // Remove lines from the beginning until we're under the limit
    // Use running byte count to avoid O(n²) behavior
    while (contentBytes > MaxTerminalOutputSize && currentLines.length > 0) {
      const removedLine = currentLines.shift(); // Remove the first (oldest) line
      if (!removedLine) break; // Safety check, though this shouldn't happen

      // Subtract the removed line's bytes plus separator bytes
      const removedLineBytes = Buffer.byteLength(removedLine, "utf8");
      const separatorBytes =
        currentLines.length > 0 ? Buffer.byteLength("\r\n", "utf8") : 0;
      contentBytes -= removedLineBytes + separatorBytes;
    }

    if (!this.isTruncated) {
      this.isTruncated = true;
      logger.warn(
        `Shell output truncated at ${MaxTerminalOutputSize} bytes - removed ${lines.length - currentLines.length} lines`,
      );
    }

    return { lines: currentLines, isTruncated: true };
  }

  /**
   * Calculates the total byte size of content when joined with separators
   */
  private calculateContentBytes(lines: string[]): number {
    if (lines.length === 0) return 0;

    let totalBytes = 0;
    for (let i = 0; i < lines.length; i++) {
      totalBytes += Buffer.byteLength(lines[i], "utf8");
      // Add separator bytes for all lines except the last one
      if (i < lines.length - 1) {
        totalBytes += Buffer.byteLength("\r\n", "utf8");
      }
    }
    return totalBytes;
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
  addLine(...lines: string[]): void {
    this.lines.push(...lines);
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
      content: joinContent(this.lines),
      status: "completed",
      isTruncated,
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
      content: joinContent(this.lines),
      status,
      isTruncated,
    };
  }
}

function joinContent(lines: string[]): string {
  return lines.join("\r\n");
}
