import { getWorkspaceFolder, ignoreWalk, isAbsolutePath } from "@/lib/fs";
import { getLogger } from "@/lib/logger";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { minimatch } from "minimatch";
import * as vscode from "vscode";

const logger = getLogger("globFilesTool");
const MaxGlobFileItems = 500;

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

  if (isAbsolutePath(searchPath)) {
    throw new Error(
      `Absolute paths are not supported: ${searchPath}. Please use a relative path.`,
    );
  }

  const files: string[] = [];
  let isTruncated = false;

  try {
    const workspaceFolder = getWorkspaceFolder();

    const startUri = vscode.Uri.joinPath(workspaceFolder.uri, searchPath);

    const allFiles = await ignoreWalk(
      startUri,
      undefined,
      undefined,
      undefined,
      abortSignal,
    );

    for (const fileResult of allFiles) {
      if (minimatch(fileResult.relativePath, globPattern, { nocase: true })) {
        files.push(fileResult.relativePath.replace(/\\/g, "/"));
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

  logger.info(`Found ${files.length} files matching pattern ${globPattern}`);
  logger.trace("Files found in globFiles:", files);
  return { files, isTruncated };
};
