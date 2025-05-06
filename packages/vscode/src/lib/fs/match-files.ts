import { getLogger } from "@/lib/logger";
import * as vscode from "vscode";

import Fuse, { type FuseResult, type IFuseOptions } from "fuse.js";
import { ignoreWalk } from "./ignore-walk";
import type { FileResult } from "./types";

const logger = getLogger("matchFile");

/**
 * Performs fuzzy search on file objects using fuse.js
 * @param query Search query string
 * @param files Array of file objects to search
 * @param fuseOptions Optional configuration for Fuse.js
 * @returns Array of search results with scores
 */
function fuzzySearch(
  query: string,
  files: ReadonlyArray<FileResult>,
  fuseOptions?: IFuseOptions<FileResult>,
): FuseResult<FileResult>[] {
  if (!query || !query.trim()) {
    return files.map((item) => ({ item, score: 0, refIndex: 0 }));
  }

  const defaultOptions: IFuseOptions<FileResult> = {
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

export interface MatchFilesOptions {
  dir: string | vscode.Uri;

  /**
   * Optional search query
   */
  query?: string;

  /**
   * Whether to traverse directories recursively
   */
  recursive?: boolean;

  /**
   * Optional cancellation token
   */
  abortSignal?: AbortSignal;
}

export async function matchFiles(
  options: MatchFilesOptions,
): Promise<FileResult[]> {
  const { dir, query, recursive = true, abortSignal } = options;

  const queryString = query?.trim().toLowerCase();

  const uri = typeof dir === "string" ? vscode.Uri.file(dir) : dir;

  const startTime = Date.now();

  const allFiles = await ignoreWalk({
    dir: uri,
    recursive,
    abortSignal,
  });

  let processedFiles = allFiles;

  // Only apply fuzzy search if withSearch is true and we have a query
  if (queryString) {
    processedFiles = fuzzySearch(queryString, allFiles).map(
      (result) => result.item,
    );
  }

  const totalTime = Date.now() - startTime;
  logger.debug(
    `File listing completed in ${totalTime}ms, returning ${processedFiles.length} results`,
  );

  return processedFiles;
}
