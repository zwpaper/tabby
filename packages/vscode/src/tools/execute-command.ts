import * as path from "node:path";
import { executeCommandByNode } from "@/integrations/terminal/execute-command";
import { TerminalJob } from "@/integrations/terminal/terminal-job";
import { waitForWebviewSubscription } from "@/integrations/terminal/utils";
import { getWorkspaceFolder } from "@/lib/fs";
import { type Signal, signal } from "@preact/signals-core";
import { ThreadSignal } from "@quilted/threads/signals";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import type { ExecuteCommandResult } from "@ragdoll/vscode-webui-bridge";

export const executeCommand: ToolFunctionType<
  ClientToolsType["executeCommand"]
> = async ({ command, cwd = ".", isDevServer, timeout }, { abortSignal }) => {
  const defaultTimeout = isDevServer ? 60 : 30; // 60 seconds for dev server, 30 seconds otherwise
  if (!command) {
    throw new Error("Command is required to execute.");
  }

  if (path.isAbsolute(cwd)) {
    cwd = path.normalize(cwd);
  } else {
    const workspaceRootUri = getWorkspaceFolder().uri;
    cwd = path.normalize(path.join(workspaceRootUri.fsPath, cwd));
  }

  let output: Signal<ExecuteCommandResult>;
  let detach: () => void = () => {};

  if (isDevServer) {
    const job = TerminalJob.create({
      name: command,
      command,
      cwd,
      abortSignal: abortSignal,
      background: isDevServer,
      timeout: timeout ?? defaultTimeout,
    });

    output = job.output;
    detach = job.detach;
  } else {
    output = signal<ExecuteCommandResult>({
      content: "",
      status: "idle",
      isTruncated: false,
    });

    waitForWebviewSubscription().then(() => {
      executeCommandByNode({
        command,
        cwd,
        timeout: timeout ?? defaultTimeout,
        abortSignal,
        onData: (data) => {
          output.value = {
            content: data.output,
            status: "running",
            isTruncated: data.isTruncated,
          };
        },
      })
        .then(({ output: commandOutput, isTruncated }) => {
          output.value = {
            content: commandOutput,
            status: "completed",
            isTruncated,
          };
        })
        .catch((error) => {
          output.value = {
            ...output.value,
            status: "completed",
            error: error.message,
          };
        });
    });
  }
  // biome-ignore lint/suspicious/noExplicitAny: pass thread signal
  return { output: ThreadSignal.serialize(output) as any, detach };
};
