import { join } from "node:path";
import { getWorkspaceFolder } from "@/lib/fs";
import { getLogger } from "@/lib/logger";
import { searchFilesWithRipgrep } from "@ragdoll/common/node";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { env } from "vscode";

const logger = getLogger("searchFiles");

export const searchFiles: ToolFunctionType<
  ClientToolsType["searchFiles"]
> = async ({ path, regex, filePattern }, { abortSignal }) => {
  const rgPath = join(
    env.appRoot,
    "node_modules",
    "@vscode",
    "ripgrep",
    "bin",
    "rg",
  );
  logger.debug(
    "handling searchFiles with path",
    path,
    "and regex",
    regex,
    "and filePattern",
    filePattern,
  );
  return await searchFilesWithRipgrep(
    path,
    regex,
    rgPath,
    getWorkspaceFolder().uri.fsPath ?? "",
    filePattern,
    abortSignal,
  );
};
