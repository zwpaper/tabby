import { exec } from "node:child_process";
import * as path from "node:path";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { getWorkspacePath } from "../lib/fs";

export const executeCommand: ToolFunctionType<
  ClientToolsType["executeCommand"]
> = async ({ command, cwd = ".", isDevServer }, { abortSignal }) => {
  if (!command) {
    throw new Error("Command is required to execute.");
  }

  if (isDevServer) {
    throw new Error(
      "Dev server commands are not supported in background execution environment.",
    );
  }

  if (path.isAbsolute(cwd)) {
    cwd = path.normalize(cwd);
  } else {
    cwd = path.normalize(path.join(getWorkspacePath(), cwd));
  }

  return await new Promise<{ success: boolean; output: string }>((resolve) => {
    exec(
      command,
      { cwd, signal: abortSignal },
      (error: Error | null, stdout: string, stderr: string) => {
        const output =
          stdout + stderr + (error ? `\nError: ${error.message}` : "");
        if (error || stderr) {
          resolve({ success: false, output });
        } else {
          resolve({ success: true, output });
        }
      },
    );
  });
};
