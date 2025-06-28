import fs from "node:fs/promises";

export async function isFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function hashWorkingDir(workingDir: string): string {
  if (!workingDir) {
    throw new Error("Working directory path cannot be empty");
  }
  let hash = 0;
  for (let i = 0; i < workingDir.length; i++) {
    hash = (hash * 31 + workingDir.charCodeAt(i)) >>> 0;
  }
  const bigHash = BigInt(hash);
  const numericHash = bigHash.toString().slice(0, 13);
  return numericHash;
}

export class Deferred<T> {
  promise: Promise<T>;
  resolve!: (value: T | PromiseLike<T>) => void;
  reject!: (reason?: unknown) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
