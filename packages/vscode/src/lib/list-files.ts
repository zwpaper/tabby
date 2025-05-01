import * as path from "node:path";
import type { Ignore } from "ignore";
import ignore from "ignore";
import * as vscode from "vscode";
import { getLogger } from "./logger";

import Fuse, { type FuseResult, type IFuseOptions } from "fuse.js";
const logger = getLogger("listFiles");

export interface FileResult {
  uri: vscode.Uri;
}

interface FileObject {
  relativePath: string;
  fullPath: string;
  basename: string;
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
  ignoreInstance: Ignore;
  uri: vscode.Uri;
}

/**
 * Traverses the file system in breadth-first manner, respecting .gitignore rules
 * @param startUri Starting directory URI
 * @param baseIg Base ignore instance
 * @param searchLimit Maximum number of files to search
 * @param token Optional cancellation token
 * @returns Array of file objects with relative paths and metadata
 */
async function traverseBFSwithGitIgnore(
  startUri: vscode.Uri,
  baseIg: Ignore,
  searchLimit: number,
  token?: vscode.CancellationToken,
): Promise<FileObject[]> {
  const scannedFileObjects: FileObject[] = [];
  let fileScannedCount = 0;
  const processedDirs = new Set<string>();
  const queue: Array<IgnoreInfo> = [{ uri: startUri, ignoreInstance: baseIg }];

  const rootDir = startUri.fsPath;

  logger.debug(`Starting traversal from ${rootDir} with limit ${searchLimit}`);

  if (token?.isCancellationRequested) {
    return [];
  }

  while (
    queue.length > 0 &&
    fileScannedCount < searchLimit &&
    !token?.isCancellationRequested
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
        if (token?.isCancellationRequested) {
          return scannedFileObjects;
        }

        const entryUri = vscode.Uri.joinPath(currentUri, name);
        const fullPath = entryUri.fsPath;
        const relativePath = path.relative(rootDir, fullPath);
        const normalizedPath = relativePath.replace(/\\/g, "/");

        if (directoryIg.ignores(normalizedPath)) {
          continue;
        }

        if (type === vscode.FileType.Directory) {
          if (!processedDirs.has(fullPath)) {
            queue.push({ uri: entryUri, ignoreInstance: directoryIg });
          }
        } else if (type === vscode.FileType.File) {
          if (fileScannedCount >= searchLimit) {
            return scannedFileObjects;
          }

          fileScannedCount++;
          scannedFileObjects.push({
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
    `Completed traversal, found ${scannedFileObjects.length} files out of ${fileScannedCount} scanned`,
  );
  return scannedFileObjects;
}

/**
 * Performs fuzzy search on file objects using fuse.js
 * @param query Search query string
 * @param files Array of file objects to search
 * @param fuseOptions Optional configuration for Fuse.js
 * @returns Array of search results with scores
 */
function fuzzySearch(
  query: string,
  files: ReadonlyArray<FileObject>,
  fuseOptions?: IFuseOptions<FileObject>,
): FuseResult<FileObject>[] {
  if (!query || !query.trim()) {
    return files.map((item) => ({ item, score: 0, refIndex: 0 }));
  }

  const defaultOptions: IFuseOptions<FileObject> = {
    keys: [
      { name: "basename", weight: 0.7 },
      { name: "relativePath", weight: 0.3 },
    ],
    includeScore: true,
    threshold: 0.5,
    shouldSort: true,
    findAllMatches: false,
    ignoreLocation: false,
    distance: 100,
    minMatchCharLength: 2,
  };

  const options = { ...defaultOptions, ...fuseOptions };

  const fuse = new Fuse(files, options);
  const trimmedQuery = query.trim().toLowerCase();

  return fuse.search(trimmedQuery);
}

/**
 * Lists files in the workspace with optional fuzzy search filtering
 * @param query Optional search string for fuzzy matching
 * @param resultLimit Maximum number of results to return
 * @param token Optional cancellation token
 * @param scanLimit Maximum number of files to scan
 * @returns Array of file results with URIs
 */
export async function listFiles(
  query?: string,
  resultLimit = 30,
  token?: vscode.CancellationToken,
  scanLimit = 10000,
): Promise<FileResult[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) {
    logger.debug("No workspace folders found");
    return [];
  }

  const queryString = query?.trim().toLowerCase();
  const rootFolder = workspaceFolders[0];

  const ig = ignore().add(".git");

  const startTime = Date.now();

  const allFiles = await traverseBFSwithGitIgnore(
    rootFolder.uri,
    ig,
    scanLimit,
    token,
  );

  if (token?.isCancellationRequested) {
    logger.debug("File listing cancelled");
    return [];
  }

  if (!allFiles.length) {
    logger.debug("No files found in workspace");
    return [];
  }

  const processedFiles = queryString
    ? fuzzySearch(queryString, allFiles).map((result) => result.item)
    : allFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const limitedResults = processedFiles.slice(0, resultLimit);
  const results = limitedResults.map((file) => ({
    uri: vscode.Uri.file(file.fullPath),
  }));

  const totalTime = Date.now() - startTime;
  logger.debug(
    `File listing completed in ${totalTime}ms, returning ${results.length} results`,
  );

  return results;
}
