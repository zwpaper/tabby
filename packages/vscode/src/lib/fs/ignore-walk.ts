import * as path from "node:path";
import { getLogger } from "@/lib/logger";
import type { Ignore } from "ignore";
import ignore from "ignore";
import * as vscode from "vscode";
import type { FileResult } from "./types";

const logger = getLogger("ignoreWalk");
const MaxScanItems = 10_000;
const CacheTtl = 60 * 1000; // 1 minute
const MaxCacheSize = 50;
const cache = new Map<string, { data: FileResult[]; expires: number }>();

function getCache(cacheKey: string): FileResult[] | null {
  const cachedItem = cache.get(cacheKey);
  if (cachedItem && cachedItem.expires > Date.now()) {
    logger.debug(`Cache hit for ${cacheKey}`);
    return cachedItem.data;
  }
  logger.debug(`Cache miss for ${cacheKey}`);
  return null;
}

function setCache(cacheKey: string, data: FileResult[]) {
  cache.set(cacheKey, {
    data,
    expires: Date.now() + CacheTtl,
  });
}

function collectCacheGarbage() {
  if (cache.size >= MaxCacheSize) {
    const now = Date.now();
    // Sort by earliest expiration first
    const sortedCache = [...cache.entries()].sort(
      (a, b) => a[1].expires - b[1].expires,
    );
    for (const [key, value] of sortedCache) {
      if (value.expires <= now || cache.size >= MaxCacheSize) {
        cache.delete(key);
        logger.debug(`Cache GC: ${key}`);
      }
    }
  }
}

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

async function ignoreWalkImpl({
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

export async function ignoreWalk(
  options: IgnoreWalkOptions,
): Promise<FileResult[]> {
  const { dir, recursive = true } = options;
  const cacheKey = `ignoreWalk:${dir.fsPath}:${recursive}`;

  const cachedData = getCache(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  collectCacheGarbage();

  const results = await ignoreWalkImpl(options);

  setCache(cacheKey, results);
  return results;
}
