import * as path from "node:path";
import { getLogger } from "@/lib/logger";
import type { Ignore } from "ignore";
import ignore from "ignore";
import * as vscode from "vscode";
import type { FileResult } from "./types";

const logger = getLogger("ignoreWalk");

/**
 * Attempts to load and parse .gitignore rules from the specified directory
 * @param directoryPath Path to directory that may contain a .gitignore file
 * @returns Array of parsed .gitignore rules (empty if file not found)
 */
async function attemptLoadIgnoreFromPath(
  directoryPath: string,
): Promise<string[]> {
  try {
    const gitignoreUri = vscode.Uri.file(
      path.join(directoryPath, ".gitignore"),
    );
    const gitignoreContentBytes =
      await vscode.workspace.fs.readFile(gitignoreUri);
    const gitignoreContent = Buffer.from(gitignoreContentBytes).toString(
      "utf8",
    );

    return gitignoreContent
      .split(/\r?\n/)
      .map((rule) => rule.trim())
      .filter((rule) => rule && !rule.startsWith("#"));
  } catch (e) {
    return [];
  }
}

interface IgnoreInfo {
  ignoreInstance: Ignore;
  uri: vscode.Uri;
}

/**
 * Traverses the file system in breadth-first manner, respecting .gitignore rules
 * @param startUri Starting directory URI
 * @param baseIg Base ignore instance
 * @param scanLimit Maximum number of files to search
 * @param recursive Whether to traverse directories recursively
 * @param token Optional cancellation token
 * @returns Array of file objects with relative paths and metadata
 */
export async function ignoreWalk(
  startUri: vscode.Uri,
  baseIg: Ignore = ignore().add(".git"),
  scanLimit = 10000,
  recursive = true,
  abortSignal?: AbortSignal,
): Promise<FileResult[]> {
  const scannedFileResults: FileResult[] = [];
  let fileScannedCount = 0;
  const processedDirs = new Set<string>();
  const queue: Array<IgnoreInfo> = [{ uri: startUri, ignoreInstance: baseIg }];

  const rootDir = startUri.fsPath;

  logger.debug(
    `Starting traversal from ${rootDir} with limit ${scanLimit}, recursive: ${recursive}`,
  );

  if (abortSignal?.aborted) {
    return [];
  }

  while (
    queue.length > 0 &&
    fileScannedCount < scanLimit &&
    !abortSignal?.aborted
  ) {
    const current = queue.shift();
    if (!current) continue;

    const { uri: currentUri, ignoreInstance: currentIg } = current;
    const currentFsPath = currentUri.fsPath;

    if (processedDirs.has(currentFsPath)) {
      continue;
    }
    processedDirs.add(currentFsPath);

    try {
      const newRules = await attemptLoadIgnoreFromPath(currentFsPath);
      const directoryIg =
        newRules.length > 0 ? ignore().add(currentIg).add(newRules) : currentIg;

      const entries = await vscode.workspace.fs.readDirectory(currentUri);

      for (const [name, type] of entries) {
        if (abortSignal?.aborted) {
          return scannedFileResults;
        }

        const entryUri = vscode.Uri.joinPath(currentUri, name);
        const fullPath = entryUri.fsPath;
        const relativePath = path.relative(rootDir, fullPath);
        const normalizedPath = relativePath.replace(/\\/g, "/");

        if (directoryIg.ignores(normalizedPath)) {
          continue;
        }

        if (type === vscode.FileType.Directory) {
          if (recursive && !processedDirs.has(fullPath)) {
            queue.push({ uri: entryUri, ignoreInstance: directoryIg });
          }

          if (!recursive) {
            fileScannedCount++;
            scannedFileResults.push({
              uri: entryUri,
              relativePath,
              fullPath,
              basename: name.toLowerCase(),
            });

            if (fileScannedCount >= scanLimit) {
              return scannedFileResults;
            }
          }
        } else if (type === vscode.FileType.File) {
          if (fileScannedCount >= scanLimit) {
            return scannedFileResults;
          }

          fileScannedCount++;
          scannedFileResults.push({
            uri: entryUri,
            relativePath,
            fullPath,
            basename: name.toLowerCase(),
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.warn(`Error reading directory ${currentUri.fsPath}: ${message}`);
    }
  }

  logger.debug(
    `Completed traversal, found ${scannedFileResults.length} files out of ${fileScannedCount} scanned`,
  );
  return scannedFileResults;
}
