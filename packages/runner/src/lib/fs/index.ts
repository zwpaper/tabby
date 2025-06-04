import * as fs from "node:fs/promises";
import * as path from "node:path";

export function getWorkspacePath(): string {
  return process.env.POCHI_TASK_RUNNER_WORKSPACE || process.cwd();
}

export function asRelativePath(pathname: string): string {
  const workspacePath = getWorkspacePath();
  if (path.isAbsolute(pathname)) {
    return path.relative(workspacePath, pathname);
  }
  return pathname;
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
