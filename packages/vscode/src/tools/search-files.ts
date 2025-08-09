import { getWorkspaceFolder, vscodeRipgrepPath } from "@/lib/fs";
import { getLogger } from "@/lib/logger";
import type { ClientToolsV5Type, ToolFunctionTypeV5 } from "@getpochi/tools";
import { searchFilesWithRipgrep } from "@ragdoll/common/node";

const logger = getLogger("searchFiles");

export const searchFiles: ToolFunctionTypeV5<
  ClientToolsV5Type["searchFiles"]
> = async ({ path, regex, filePattern }, { abortSignal }) => {
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
    vscodeRipgrepPath,
    getWorkspaceFolder().uri.fsPath ?? "",
    filePattern,
    abortSignal,
  );
};
