import * as path from "node:path";
import { getWorkspaceFolder, isAbsolutePath, matchFiles } from "@/lib/fs";
import { getLogger } from "@/lib/logger";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";

const logger = getLogger("listFilesTool");

const MaxListFileItems = 500;

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

  if (isAbsolutePath(dirPath)) {
    logger.error(`Absolute paths are not supported: ${dirPath}`);
    throw new Error(
      `Absolute paths are not supported: ${dirPath}. Please use a relative path.`,
    );
  }

  try {
    const workspaceFolder = getWorkspaceFolder();

    const startPath = path.join(workspaceFolder.uri.fsPath, dirPath);
    const fileResults = await matchFiles({
      startPath,
      recursive: !!recursive,
      abortSignal,
    });

    const isTruncated = fileResults.length > MaxListFileItems;
    const files = fileResults
      .slice(0, MaxListFileItems)
      .map((x) => x.relativePath);

    return { files, isTruncated };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error listing files:", errorMessage);
    throw new Error(`Failed to list files: ${errorMessage}`);
  }
};
