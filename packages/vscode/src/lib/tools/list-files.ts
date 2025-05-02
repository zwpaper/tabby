import * as path from "node:path";
import { DEFAULT_MAX_FILES, listFiles as libListFiles } from "@/lib/list-files";
import { getLogger } from "@/lib/logger";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { CancellationTokenSource } from "vscode";
import { getWorkspaceFolder, isAbsolutePath } from "../file-utils";
const logger = getLogger("listFilesTool");

/**
 * Lists files and directories within the specified path
 */
export const listFiles: ToolFunctionType<ClientToolsType["listFiles"]> = async (
  { path: dirPath, recursive },
  { abortSignal },
) => {
  logger.debug(
    "handling listFile with dirPath",
    dirPath,
    "and recursive",
    recursive,
  );

  if (!dirPath || isAbsolutePath(dirPath)) {
    logger.warn(`Absolute paths are not supported: ${dirPath}`);
    return { files: [], isTruncated: false };
  }

  const files: string[] = [];
  let isTruncated = false;

  try {
    const workspaceFolder = getWorkspaceFolder();
    const cancellationTokenSource = new CancellationTokenSource();
    if (abortSignal) {
      abortSignal.addEventListener("abort", () => {
        cancellationTokenSource.cancel();
      });
    }

    const startPath = path.join(workspaceFolder.uri.fsPath, dirPath);
    const fileResults = await libListFiles({
      startPath,
      recursive: !!recursive,
      token: cancellationTokenSource.token,
      resultLimit: DEFAULT_MAX_FILES,
    });

    for (const result of fileResults) {
      files.push(result.relativePath);
      // if files.length > DEFAULT_MAX_FILES, we need to truncate the list
      if (files.length > DEFAULT_MAX_FILES) {
        isTruncated = true;
        break;
      }
    }

    if (cancellationTokenSource.token.isCancellationRequested) {
      logger.debug("List files operation aborted");
      return { files: [], isTruncated: false };
    }
  } catch (error) {
    logger.error("Error listing files:", error);
    return { files: [], isTruncated: false };
  }

  return { files, isTruncated };
};
