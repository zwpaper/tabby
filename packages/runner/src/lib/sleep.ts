export async function sleep(
  ms: number,
  abortSignal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (abortSignal) {
      abortSignal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(abortSignal.reason);
        },
        { once: true },
      );
    }
  });
}
