import * as path from "node:path";
import { minimatch } from "minimatch";
import { getLogger } from "../base";
import { resolvePath, validateRelativePath } from "./fs";
import { ignoreWalk } from "./ignore-walk";
import { MaxGlobFileItems } from "./limits";

const logger = getLogger("globFiles");

interface GlobFilesOptions {
  /** Current working directory (workspace root) */
  cwd: string;
  /** The relative directory path to search in */
  path: string;
  /** The glob pattern to match files against */
  globPattern: string;
  /** AbortSignal for cancellation */
  abortSignal?: AbortSignal;
}

interface GlobFilesResult {
  /** Array of relative file paths matching the pattern */
  files: string[];
  /** Whether the results were truncated due to MaxGlobFileItems limit */
  isTruncated: boolean;
}

/**
 * Common utility for finding files matching a glob pattern.
 * This function abstracts the common logic between different implementations
 * (runner vs vscode) while providing consistent glob matching behavior.
 */
export async function globFiles(
  options: GlobFilesOptions,
): Promise<GlobFilesResult> {
  const { cwd, path: searchPath, globPattern, abortSignal } = options;

  logger.debug(
    "handling globFiles with searchPath:",
    searchPath,
    "and pattern",
    globPattern,
  );

  // Resolve path (absolute or relative)
  const dir = resolvePath(searchPath, cwd);

  // Only validate relative paths
  if (!path.isAbsolute(searchPath)) {
    validateRelativePath(searchPath);
  }

  const files: string[] = [];
  let isTruncated = false;

  try {
    const allFiles = await ignoreWalk({
      dir,
      recursive: true,
      abortSignal,
    });

    for (const fileResult of allFiles) {
      if (minimatch(fileResult.relativePath, globPattern, { nocase: true })) {
        files.push(fileResult.relativePath);
        if (files.length >= MaxGlobFileItems) {
          isTruncated = true;
          break;
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to glob files: ${errorMessage}`);
  }

  logger.debug(`Found ${files.length} files matching pattern ${globPattern}`);
  logger.trace("Files found in globFiles:", files);
  return { files, isTruncated };
}
