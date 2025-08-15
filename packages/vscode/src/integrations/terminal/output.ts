import { getLogger } from "@/lib/logger";
import { signal } from "@preact/signals-core";
import { MaxTerminalOutputSize } from "@ragdoll/common/tool-utils";
import type { ExecuteCommandResult } from "@ragdoll/vscode-webui-bridge";
import type { ExecutionError } from "./utils";

const logger = getLogger("TerminalOutput");

/**
 * Result of content truncation operation
 */
interface TruncationResult {
  chunks: string[];
  isTruncated: boolean;
}

/**
 * Handles content truncation logic for shell output
 */
export class OutputTruncator {
  private isTruncated = false;

  /**
   * Truncates chunks to stay within the maximum content size limit
   */
  truncateChunks(chunks: string[]): TruncationResult {
    const currentChunks = [...chunks];

    // Calculate initial content size using the same separator as joinContent
    let contentBytes = calculateContentBytes(currentChunks);

    if (contentBytes <= MaxTerminalOutputSize) {
      return { chunks: currentChunks, isTruncated: this.isTruncated };
    }

    // Remove chunks from the beginning until we're under the limit
    while (contentBytes > MaxTerminalOutputSize && currentChunks.length > 1) {
      const removedChunk = currentChunks.shift(); // Remove the first (oldest) chunk
      if (!removedChunk) break; // Safety check, though this shouldn't happen

      // Subtract the removed chunk's bytes
      const removedChunkBytes = Buffer.byteLength(removedChunk, "utf8");
      contentBytes -= removedChunkBytes;
    }

    // If only one chunk left but still exceeds limit, truncate its content
    if (contentBytes > MaxTerminalOutputSize && currentChunks.length === 1) {
      currentChunks[0] = truncateTextByLimit(
        currentChunks[0],
        MaxTerminalOutputSize,
      );
    }

    if (!this.isTruncated) {
      this.isTruncated = true;
      logger.warn(`Shell output truncated at ${MaxTerminalOutputSize} bytes`);
    }

    return { chunks: currentChunks, isTruncated: true };
  }
}

/**
 * Truncates a single text chunk to fit within the specified byte limit
 * Uses binary search to find the maximum length that fits within the limit
 */
function truncateTextByLimit(chunk: string, limit: number): string {
  let left = 0;
  let right = chunk.length;

  while (left < right) {
    const mid = Math.floor((left + right + 1) / 2);
    const candidate = chunk.substring(chunk.length - mid);

    if (Buffer.byteLength(candidate, "utf8") <= limit) {
      left = mid;
    } else {
      right = mid - 1;
    }
  }

  return chunk.substring(chunk.length - left);
}

/**
 * Calculates the total byte size of content
 */
function calculateContentBytes(chunks: string[]): number {
  if (chunks.length === 0) return 0;

  let totalBytes = 0;
  for (let i = 0; i < chunks.length; i++) {
    totalBytes += Buffer.byteLength(chunks[i], "utf8");
  }
  return totalBytes;
}

export class OutputManager {
  public readonly output = signal<ExecuteCommandResult>({
    content: "",
    status: "idle",
    isTruncated: false,
  });

  /**
   * output text chunks, a chunk may contain multiple lines
   */
  private chunks: string[] = [];
  private truncator = new OutputTruncator();

  /**
   * Adds a new line to the output and updates the signal
   */
  addChunk(chunk: string): void {
    this.chunks.push(chunk);
    this.updateOutput("running");
  }

  /**
   * Finalizes the output with completion status and optional error
   */
  finalize(detached: boolean, error?: ExecutionError): void {
    // Final truncation check
    const { chunks: finalChunks, isTruncated } = this.truncator.truncateChunks(
      this.chunks,
    );
    this.chunks = finalChunks;
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
      content: joinContent(this.chunks),
      status: "completed",
      isTruncated,
      error: errorText,
    };
  }

  /**
   * Updates the output signal with current content and status
   */
  private updateOutput(status: ExecuteCommandResult["status"]): void {
    const { chunks: truncatedChunks, isTruncated } =
      this.truncator.truncateChunks(this.chunks);
    this.chunks = truncatedChunks;

    this.output.value = {
      content: joinContent(this.chunks),
      status,
      isTruncated,
    };
  }
}

/**
 * Joins an array of text chunks into a single string
 * As \r and \n has special meaning in terminal, we just join them directly
 * @param chunks The text chunks to join
 * @returns The joined string
 */
function joinContent(chunks: string[]): string {
  return chunks.join("");
}
