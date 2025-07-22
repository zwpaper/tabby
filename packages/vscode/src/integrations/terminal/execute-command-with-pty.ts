import * as path from "node:path";
import { getLogger } from "@ragdoll/common";
import { getShellPath } from "@ragdoll/common/node";
import type * as nodePty from "node-pty";
import * as vscode from "vscode";
import { executeCommandWithNode } from "./execute-command-with-node";
import { ExecutionError, truncateOutput } from "./utils";

const logger = getLogger("ExecuteCommandWithPty");

// Options for the execute command function
interface ExecuteCommandOptions {
  command: string;
  cwd: string;
  timeout: number;
  abortSignal?: AbortSignal;
}

const nodePtyPath = path.join(
  vscode.env.appRoot,
  "node_modules",
  "node-pty",
  "lib",
  "index.js",
);

export const executeCommandWithPty = async ({
  command,
  cwd,
  timeout,
  abortSignal,
  onData,
}: ExecuteCommandOptions & {
  onData?: (data: { output: string; isTruncated: boolean }) => void;
}) => {
  let pty: typeof nodePty;
  try {
    logger.debug(
      `Executing command with pty: ${command} in ${cwd}, node-pty path: ${nodePtyPath}`,
    );
    pty = await import(nodePtyPath);
  } catch (e) {
    logger.warn(
      `Failed to spawn pty, falling back to node's child_process.spawn: ${e}`,
    );
    return executeCommandWithNode({
      command,
      cwd,
      timeout,
      abortSignal,
      onData,
    });
  }

  const shell = getShellPath() || "/bin/bash";
  return new Promise<{ output: string; isTruncated: boolean }>(
    (resolve, reject) => {
      const ptyProcess = pty.spawn(shell, ["-c", command], {
        // Using 'xterm-256color' here helps ensure that the majority of Linux distributions will use a
        // color prompt as defined in the default ~/.bashrc file.
        name: "xterm-256color",
        cols: 80,
        rows: 30,
        cwd,
        env: {
          ...process.env,
          PAGER: "cat",
        },
      });

      let output = "";
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          ptyProcess.kill("SIGTERM");
          reject(ExecutionError.createTimeoutError(timeout));
        }, timeout * 1000);
      }

      const onAbort = () => {
        ptyProcess.kill("SIGTERM");
        reject(ExecutionError.createAbortError());
      };
      abortSignal?.addEventListener("abort", onAbort);

      const dataListener = ptyProcess.onData((data: string) => {
        output = output + data;
        onData?.(truncateOutput(output));
      });

      const exitListener = ptyProcess.onExit(({ exitCode }) => {
        if (timeoutId) clearTimeout(timeoutId);
        abortSignal?.removeEventListener("abort", onAbort);
        dataListener.dispose();
        exitListener.dispose();

        if (exitCode === 0) {
          resolve(truncateOutput(output));
        } else {
          reject(
            ExecutionError.create(`Command exited with code ${exitCode}.`),
          );
        }
      });
    },
  );
};
