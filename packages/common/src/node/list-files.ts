import * as path from "node:path";
import { getLogger } from "..";
import { validateRelativePath } from "./fs";
import { ignoreWalk } from "./ignore-walk";

const logger = getLogger("listFiles");
const MaxListFileItems = 500;

interface ListFilesOptions {
  cwd: string;
  /** The relative directory path to list files from */
  path: string;
  /** Whether to recursively list files */
  recursive?: boolean;
  /** AbortSignal for cancellation */
  abortSignal?: AbortSignal;
}

interface ListFilesResult {
  /** Array of relative file paths */
  files: string[];
  /** Whether the results were truncated due to MaxListFileItems limit */
  isTruncated: boolean;
}

/**
 * Common utility for listing files with ignore patterns applied.
 * This function abstracts the common logic between different implementations
 * (runner vs vscode) while allowing them to provide their own path handling.
 */
export async function listFiles(
  options: ListFilesOptions,
): Promise<ListFilesResult> {
  const { cwd, path: dirPath, recursive, abortSignal } = options;

  logger.debug(
    "handling listFile with dirPath",
    dirPath,
    "and recursive",
    recursive,
  );

  validateRelativePath(dirPath);

  try {
    const dir = path.join(cwd, dirPath);

    const fileResults = await ignoreWalk({
      dir,
      recursive: !!recursive,
      abortSignal,
    });

    const isTruncated = fileResults.length > MaxListFileItems;
    const files = fileResults
      .slice(0, MaxListFileItems)
      .map((x) => path.relative(cwd, x.filepath));

    return { files, isTruncated };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error listing files:", errorMessage);
    throw new Error(`Failed to list files: ${errorMessage}`);
  }
}
