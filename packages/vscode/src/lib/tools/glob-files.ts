import { traverseBFSwithGitIgnore } from "@/lib/list-files";
import { getLogger } from "@/lib/logger";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { minimatch } from "minimatch";
import { CancellationTokenSource, window, workspace } from "vscode";
import * as vscode from "vscode";
import { isAbsolutePath } from "../file-utils";

const logger = getLogger("globFilesTool");
const MAX_FILES = 300;

/**
 * Finds files matching a glob pattern within the specified directory
 */
export const globFiles: ToolFunctionType<ClientToolsType["globFiles"]> = async (
  { path: searchPath, globPattern },
  { abortSignal },
) => {
  logger.debug(
    "handling globFiles with searchPath:",
    searchPath,
    "and pattern",
    globPattern,
  );

  if (!searchPath || isAbsolutePath(searchPath)) {
    logger.warn(`Absolute paths are not supported: ${searchPath}`);
    return { files: [], isTruncated: false };
  }

  if (!globPattern) {
    logger.warn("No glob pattern provided");
    return { files: [], isTruncated: false };
  }

  const files: string[] = [];
  let isTruncated = false;

  try {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      logger.error("No workspace folder found.");
      window.showErrorMessage("No workspace folder found.");
      return { files: [], isTruncated: false };
    }

    const cancellationTokenSource = new CancellationTokenSource();
    if (abortSignal) {
      abortSignal.addEventListener("abort", () => {
        cancellationTokenSource.cancel();
      });
    }

    const startUri = vscode.Uri.joinPath(workspaceFolders[0].uri, searchPath);

    const allFiles = await traverseBFSwithGitIgnore(
      startUri,
      undefined,
      undefined,
      undefined,
      cancellationTokenSource.token,
    );

    if (cancellationTokenSource.token.isCancellationRequested) {
      logger.debug("Glob files operation aborted");
      return { files: [], isTruncated: false };
    }

    for (const fileResult of allFiles) {
      if (minimatch(fileResult.relativePath, globPattern, { nocase: true })) {
        files.push(fileResult.relativePath.replace(/\\/g, "/"));
        if (files.length >= MAX_FILES) {
          isTruncated = true;
          break;
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error globbing files:", errorMessage);
    return { files: [], isTruncated: false };
  }

  logger.debug(`Found ${files.length} files matching pattern ${globPattern}`);
  logger.trace("Files found in globFiles:", files);
  return { files, isTruncated };
};
