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

export interface IgnoreWalkOptions {
  dir: vscode.Uri;
  recursive?: boolean;
  abortSignal?: AbortSignal;
}

async function processDirectoryEntry(
  entry: [string, vscode.FileType],
  currentUri: vscode.Uri,
  rootDir: string,
  directoryIg: Ignore,
  recursive: boolean,
  processedDirs: Set<string>,
  queue: Array<IgnoreInfo>,
  scannedFileResults: FileResult[],
): Promise<boolean> {
  // Returns true if MaxScanItems is reached
  const [name, type] = entry;
  const entryUri = vscode.Uri.joinPath(currentUri, name);
  const fullPath = entryUri.fsPath;
  const relativePath = path.relative(rootDir, fullPath);
  // Normalize path separators to forward slashes for consistent ignore matching
  const normalizedPath = relativePath.replace(/\\/g, "/");

  if (directoryIg.ignores(normalizedPath)) {
    return false;
  }

  if (type === vscode.FileType.Directory) {
    if (recursive && !processedDirs.has(fullPath)) {
      queue.push({ uri: entryUri, ignore: directoryIg });
    }
    // Directories are also added to results, similar to files
    scannedFileResults.push({
      uri: entryUri,
      relativePath,
      isDir: true,
    });
  } else if (type === vscode.FileType.File) {
    scannedFileResults.push({
      uri: entryUri,
      relativePath,
      isDir: false,
    });
  }
  // For both files and directories that are not ignored
  return scannedFileResults.length >= MaxScanItems;
}

export async function ignoreWalk({
  dir,
  recursive = true,
  abortSignal,
}: IgnoreWalkOptions): Promise<FileResult[]> {
  const scannedFileResults: FileResult[] = [];
  const processedDirs = new Set<string>();
  const queue: Array<IgnoreInfo> = [{ uri: dir, ignore: ignore().add(".git") }];
  const rootDir = dir.fsPath;

  logger.trace(
    `Starting traversal from ${rootDir} with limit ${MaxScanItems}, recursive: ${recursive}`,
  );

  if (abortSignal?.aborted) {
    logger.debug("Traversal aborted before starting.");
    return [];
  }

  let fileScannedCount = 0; // Tracks items processed against MaxScanItems

  while (
    queue.length > 0 &&
    fileScannedCount < MaxScanItems &&
    !abortSignal?.aborted
  ) {
    const current = queue.shift();
    if (!current) continue; // Should not happen if queue.length > 0

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

      for (const entry of entries) {
        if (abortSignal?.aborted) {
          logger.debug("Traversal aborted during directory processing.");
          break; // Break from processing entries in the current directory
        }

        const maxItemsReached = await processDirectoryEntry(
          entry,
          currentUri,
          rootDir,
          directoryIg,
          recursive,
          processedDirs,
          queue,
          scannedFileResults,
        );

        // Increment count for each item considered (file or directory), not just added to results
        // This count is to prevent excessive scanning, not just limiting result size.
        fileScannedCount++;

        if (maxItemsReached || fileScannedCount >= MaxScanItems) {
          logger.debug(
            `MaxScanItems (${MaxScanItems}) reached or exceeded. Halting traversal.`,
          );
          // Ensure the outer while loop also terminates
          // Setting queue.length = 0 is a more direct way to stop if abortSignal is not set
          queue.length = 0;
          break; // Break from processing entries in the current directory
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Error reading directory ${currentUri.fsPath}: ${message}`);
    }
  }

  logger.trace(
    `Completed traversal. Found ${scannedFileResults.length} items. Processed approximately ${fileScannedCount} entries.`,
  );
  return scannedFileResults;
}
