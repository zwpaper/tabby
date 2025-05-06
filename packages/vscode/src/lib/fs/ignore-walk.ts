import * as path from "node:path";
import { getLogger } from "@/lib/logger";
import type { Ignore } from "ignore";
import ignore from "ignore";
import * as vscode from "vscode";
import type { FileResult } from "./types";

const logger = getLogger("ignoreWalk");
const MaxScanItems = 10_000;

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
  ignore: Ignore;
  uri: vscode.Uri;
}

/**
 * Traverses the file system in breadth-first manner, respecting .gitignore rules
 * @param options Options for the ignore walk
 * @returns Array of file objects with relative paths and metadata
 */
export interface IgnoreWalkOptions {
  dir: vscode.Uri;
  recursive?: boolean;
  abortSignal?: AbortSignal;
}

export async function ignoreWalk({
  dir,
  recursive = true,
  abortSignal,
}: IgnoreWalkOptions): Promise<FileResult[]> {
  const scannedFileResults: FileResult[] = [];
  let fileScannedCount = 0;
  const processedDirs = new Set<string>();
  const queue: Array<IgnoreInfo> = [{ uri: dir, ignore: ignore().add(".git") }];

  const rootDir = dir.fsPath;

  logger.debug(
    `Starting traversal from ${rootDir} with limit ${MaxScanItems}, recursive: ${recursive}`,
  );

  if (abortSignal?.aborted) {
    return [];
  }

  while (
    queue.length > 0 &&
    fileScannedCount < MaxScanItems &&
    !abortSignal?.aborted
  ) {
    const current = queue.shift();
    if (!current) continue;

    const { uri: currentUri, ignore: currentIg } = current;
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
            queue.push({ uri: entryUri, ignore: directoryIg });
          }

          if (!recursive) {
            fileScannedCount++;
            scannedFileResults.push({
              uri: entryUri,
              relativePath,
              fullPath,
              basename: name.toLowerCase(),
            });

            if (fileScannedCount >= MaxScanItems) {
              return scannedFileResults;
            }
          }
        } else if (type === vscode.FileType.File) {
          if (fileScannedCount >= MaxScanItems) {
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
