import { type ExecException, exec } from "node:child_process";
import * as path from "node:path";
import { promisify } from "node:util";
import { MaxTerminalOutputSize } from "@ragdoll/common/node";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import type { ToolCallOptions } from "../types";

const execCommand = promisify(exec);

export const executeCommand =
  (
    context: ToolCallOptions,
  ): ToolFunctionType<ClientToolsType["executeCommand"]> =>
  async (
    { command, cwd = ".", isDevServer, timeout = 15 },
    { abortSignal },
  ) => {
    if (!command) {
      throw new Error("Command is required to execute.");
    }

    if (isDevServer) {
      throw new Error(
        "CRITICAL: Dev server commands block task execution indefinitely and must not be run in automated tasks. Use non-blocking alternatives instead.",
      );
    }

    let resolvedCwd: string;
    if (path.isAbsolute(cwd)) {
      resolvedCwd = path.normalize(cwd);
    } else {
      resolvedCwd = path.normalize(path.join(context.cwd, cwd));
    }

    try {
      const shell = ["linux", "darwin"].includes(process.platform)
        ? "/bin/bash"
        : undefined;

      const { stdout, stderr } = await execCommand(command, {
        shell,
        timeout: timeout * 1000, // Convert to milliseconds
        cwd: resolvedCwd,
        signal: abortSignal,
        env: {
          ...process.env,
          GH_PAGER: "",
        },
      });
      // need CRLF ('\r\n') as line separator, '\n' only moves the cursor one line down but not to the beginning
      const fullOutput = (stdout + stderr).replace(/(?<!\r)\n/g, "\r\n");
      const isTruncated = fullOutput.length > MaxTerminalOutputSize;
      const output = isTruncated
        ? fullOutput.slice(-MaxTerminalOutputSize)
        : fullOutput;

      return { output, isTruncated };
    } catch (error) {
      if (error instanceof Error) {
        // Handle abort signal
        if (error.name === "AbortError") {
          throw new Error("Command execution was aborted");
        }

        // Handle timeout
        const execError = error as ExecException;
        if (execError.signal === "SIGTERM" && execError.killed) {
          throw new Error(
            `Command execution timed out after ${timeout} seconds.`,
          );
        }
      }

      // Handle other execution errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Command execution failed: ${errorMessage}`);
    }
  };
