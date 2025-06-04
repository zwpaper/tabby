import * as fs from "node:fs/promises";
import * as path from "node:path";

export function getWorkspacePath(): string {
  return process.cwd();
}

/**
 * Ensure a directory exists by creating it if needed
 */
export async function ensureFileDirectoryExists(
  fileUri: string,
): Promise<void> {
  const dirUri = path.join(fileUri, "..");
  await fs.mkdir(dirUri, { recursive: true });
}
