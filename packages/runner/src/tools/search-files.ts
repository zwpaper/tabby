import { execSync } from "node:child_process";
import * as fs from "node:fs/promises";
import { getLogger } from "@ragdoll/common";
import { searchFilesWithRipgrep } from "@ragdoll/common/node";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { rgPath as rg } from "vscode-ripgrep";
import { asRelativePath, getWorkspacePath } from "../lib/fs";

/**
 * Synchronously check if a command exists in the system PATH
 * @param command - The command to check
 * @returns True if command exists, false otherwise
 */
function commandExistsSync(command: string): boolean {
  const isWindows = process.platform === "win32";
  const checkCommand = isWindows ? "where" : "which";

  try {
    execSync(`${checkCommand} ${command}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const logger = getLogger("searchFiles");

export const searchFiles: ToolFunctionType<
  ClientToolsType["searchFiles"]
> = async ({ path, regex, filePattern }, { abortSignal }) => {
  let rgPath = process.env.RIPGREP_PATH || rg;
  if (!(await fs.exists(rgPath))) {
    if (commandExistsSync("rg")) {
      rgPath = "rg"; // Fallback to 'rg' if the rgPath is not found
    } else {
      logger.error("Ripgrep not found at path", rgPath);
      throw new Error(`Ripgrep not found at path: ${rgPath}`);
    }
  }
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
    getWorkspacePath(),
    asRelativePath,
    filePattern,
    abortSignal,
  );
};
