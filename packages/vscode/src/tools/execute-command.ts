import * as path from "node:path";
import { TerminalJob } from "@/integrations/terminal/terminal-job";
import { getWorkspaceFolder } from "@/lib/fs";
import { ThreadSignal } from "@quilted/threads/signals";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";

export const executeCommand: ToolFunctionType<
  ClientToolsType["executeCommand"]
> = async ({ command, cwd = ".", isDevServer }, { abortSignal }) => {
  if (!command) {
    throw new Error("Command is required to execute.");
  }

  if (path.isAbsolute(cwd)) {
    cwd = path.normalize(cwd);
  } else {
    const workspaceRootUri = getWorkspaceFolder().uri;
    cwd = path.normalize(path.join(workspaceRootUri.fsPath, cwd));
  }

  const job = TerminalJob.create({
    name: command,
    command,
    cwd,
    abortSignal: abortSignal,
    background: isDevServer,
  });

  // biome-ignore lint/suspicious/noExplicitAny: pass thread signal
  const output = ThreadSignal.serialize(job.output) as any;
  return { output, detach: job.detach };
};
