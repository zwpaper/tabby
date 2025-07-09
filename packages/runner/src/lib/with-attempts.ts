import { toError } from "./error-utils";
import { sleep } from "./sleep";

// Max attempts for each http request.
const MaxRequestAttempts = 3;

export async function withAttempts<T>(
  execute: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    interval?: (attempt: number) => number;
    abortSignal?: AbortSignal;
  },
): Promise<T> {
  const {
    maxAttempts = MaxRequestAttempts,
    interval = (attempt: number) => {
      if (attempt <= 1) {
        return 1000; // 1 second for the first attempt
      }
      return 10 * 1000; // 10 seconds for subsequent attempts
    },
    abortSignal,
  } = options ?? {};

  let error: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await execute();
    } catch (e) {
      if (
        e instanceof Error &&
        e.name === "AbortError" &&
        abortSignal?.aborted
      ) {
        // If the error is an AbortError and the abort signal is triggered, rethrow it.
        throw e;
      }
      error = toError(e);
    }
    if (attempt < maxAttempts) {
      const waitTime = interval(attempt);
      await sleep(waitTime, abortSignal);
    }
  }
  throw new Error(
    `Failed after ${maxAttempts} attempts: ${error?.message || "Unknown error"}`,
    { cause: error },
  );
}
