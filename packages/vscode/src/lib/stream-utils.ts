import { getLogger } from "@/lib/logger";

const logger = getLogger("streamUtils");

export interface StreamWithAbortOptions {
  /**
   * Optional timeout in milliseconds for dev server streams.
   * When provided, the stream will automatically resolve after this timeout
   * if no new data is received within the timeout period.
   */
  timeout?: number;
  /**
   * Whether to reset the timeout on each new data chunk.
   * Only applicable when timeout is provided.
   */
  resetTimeoutOnData?: boolean;
}

/**
 * Reads from an async iterable stream with proper abort signal handling.
 *
 * @param outputStream - The async iterable stream to read from
 * @param abortSignal - Optional abort signal to cancel the stream reading
 * @param options - Optional configuration for timeout behavior
 * @returns Promise that resolves to the collected output string
 */
export async function streamWithAbort(
  outputStream: AsyncIterable<string>,
  abortSignal?: AbortSignal,
  options: StreamWithAbortOptions = {},
): Promise<string> {
  let output = "";
  let aborted = false;
  let abortListener: (() => void) | null = null;
  let timeoutId: Timer | undefined;

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    if (abortSignal && abortListener) {
      abortSignal.removeEventListener("abort", abortListener);
      abortListener = null;
    }
  };

  return new Promise<string>((resolve, reject) => {
    const finalCleanup = () => {
      cleanup();
      resolve(output);
    };

    const setupTimeout = () => {
      if (options.timeout) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          logger.debug("Stream timeout reached, resolving with current output");
          finalCleanup();
        }, options.timeout);
      }
    };

    try {
      // Set up abort signal handling
      if (abortSignal) {
        if (abortSignal.aborted) {
          logger.info("Stream collection aborted before starting");
          resolve(output);
          return;
        }

        abortListener = () => {
          aborted = true;
          logger.info("Stream collection aborted");
          finalCleanup();
        };

        abortSignal.addEventListener("abort", abortListener);
      }

      // Set up initial timeout if specified
      setupTimeout();

      // Start reading the stream
      (async () => {
        try {
          const reader = outputStream[Symbol.asyncIterator]();

          while (!aborted) {
            const { value, done } = await reader.next();

            if (done) {
              break;
            }

            if (aborted) {
              break;
            }

            output += value;

            // Reset timeout on new data if configured
            if (options.timeout && options.resetTimeoutOnData) {
              setupTimeout();
            }
          }

          // Properly close the iterator if it has a return method
          if (aborted && typeof reader.return === "function") {
            try {
              await reader.return();
            } catch (error) {
              // Ignore errors during cleanup
              logger.debug("Error during stream cleanup:", error);
            }
          }

          // Command finished before timeout or abort
          finalCleanup();
        } catch (error) {
          cleanup();
          reject(error);
        }
      })();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

/**
 * Convenience function for reading streams with timeout behavior (typically for dev servers).
 *
 * @param outputStream - The async iterable stream to read from
 * @param abortSignal - Optional abort signal to cancel the stream reading
 * @param timeoutMs - Timeout in milliseconds (defaults to 5000ms)
 * @returns Promise that resolves to the collected output string
 */
export async function streamWithTimeout(
  outputStream: AsyncIterable<string>,
  abortSignal?: AbortSignal,
  timeoutMs = 5000,
): Promise<string> {
  return streamWithAbort(outputStream, abortSignal, {
    timeout: timeoutMs,
    resetTimeoutOnData: true,
  });
}
