import * as path from "node:path";
import { getWorkspaceFolder, ignoreWalk } from "@/lib/fs";
import { getLogger } from "@/lib/logger";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import * as vscode from "vscode";

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

  if (path.isAbsolute(dirPath)) {
    logger.error(`Absolute paths are not supported: ${dirPath}`);
    throw new Error(
      `Absolute paths are not supported: ${dirPath}. Please use a relative path.`,
    );
  }

  try {
    const workspaceFolder = getWorkspaceFolder();

    const dir = vscode.Uri.joinPath(workspaceFolder.uri, dirPath);
    const fileResults = await ignoreWalk({
      dir,
      recursive: !!recursive,
      abortSignal,
    });

    const isTruncated = fileResults.length > MaxListFileItems;
    const files = fileResults
      .slice(0, MaxListFileItems)
      .map((x) => vscode.workspace.asRelativePath(x.uri));

    return { files, isTruncated };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error listing files:", errorMessage);
    throw new Error(`Failed to list files: ${errorMessage}`);
  }
};
