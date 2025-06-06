import { exec } from "node:child_process";
import * as path from "node:path";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import type { RunnerContext } from "../task-runner";

export const executeCommand =
  (
    context: RunnerContext,
  ): ToolFunctionType<ClientToolsType["executeCommand"]> =>
  async ({ command, cwd = ".", isDevServer }, { abortSignal }) => {
    if (!command) {
      throw new Error("Command is required to execute.");
    }

    if (isDevServer) {
      throw new Error(
        "Dev server commands are not supported in background execution environment.",
      );
    }

    let resolvedCwd: string;
    if (path.isAbsolute(cwd)) {
      resolvedCwd = path.normalize(cwd);
    } else {
      resolvedCwd = path.normalize(path.join(context.cwd, cwd));
    }

    return await new Promise<{ success: boolean; output: string }>(
      (resolve) => {
        exec(
          command,
          { cwd: resolvedCwd, signal: abortSignal },
          (error: Error | null, stdout: string, stderr: string) => {
            const output = (
              stdout +
              stderr +
              (error ? `\nError: ${error.message}` : "")
            ).replace(/(?<!\r)\n/g, "\r\n"); // need CRLF ('\r\n') as line separator, '\n' only moves the cursor one line down but not to the beginning
            if (error || stderr) {
              resolve({ success: false, output });
            } else {
              resolve({ success: true, output });
            }
          },
        );
      },
    );
  };
