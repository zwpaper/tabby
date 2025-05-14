import * as path from "node:path";
import { getWorkspaceFolder } from "@/lib/fs";
import { getLogger } from "@/lib/logger";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import * as vscode from "vscode";

const logger = getLogger("executeCommand");

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

  const shell = await getPochiShell(cwd, isDevServer);

  if (!shell) {
    throw new Error(
      "Failed to start teriminal, please restart VSCode and try again.",
    );
  }

  if (cwd && shell.cwd?.path !== cwd) {
    shell.executeCommand(`cd ${cwd}`);
  }

  const execution = shell.executeCommand(command);
  const output = await collectOutput(execution, isDevServer, abortSignal);

  return { output };
};

async function collectDevServerOutputWithTimeout(
  outputStream: AsyncIterable<string>,
): Promise<string> {
  let output = "";
  let timeoutId: Timer | undefined;

  return new Promise<string>((resolve) => {
    const resetTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        resolve(output);
      }, 5000);
    };

    resetTimeout(); // Initial timeout

    (async () => {
      for await (const data of outputStream) {
        output += data;
        resetTimeout(); // Reset timeout on new data
      }
      // Command finished before timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve(output);
    })();
  });
}

async function collectOutput(
  execution: vscode.TerminalShellExecution,
  isDevServer?: boolean,
  abortSignal?: AbortSignal,
): Promise<string> {
  logger.info(
    "Collecting output from terminal shell execution",
    execution.commandLine.value,
    isDevServer,
  );

  const outputStream = execution.read();
  if (isDevServer) {
    return collectDevServerOutputWithTimeout(outputStream);
  }

  const pollStreamAndAbortSignal = async (
    outputStream: AsyncIterable<string>,
    abortSignal?: AbortSignal,
  ): Promise<string> => {
    let output = "";

    const pollStream = async () => {
      for await (const data of outputStream) {
        output += data;
      }
    };

    const pollAbortSignal = async () => {
      return new Promise<void>((resolve) => {
        if (abortSignal) {
          abortSignal.addEventListener("abort", () => {
            logger.info("Aborted collecting output");
            resolve();
          });
        }
      });
    };

    await Promise.race([pollStream(), pollAbortSignal()]);

    return output;
  };

  return await pollStreamAndAbortSignal(outputStream, abortSignal);
}

async function retrieveShellIntegration(
  targetTerminal: vscode.Terminal,
): Promise<vscode.TerminalShellIntegration | undefined> {
  if (targetTerminal.shellIntegration) {
    return targetTerminal.shellIntegration;
  }

  return new Promise((resolve) => {
    const disposables: vscode.Disposable[] = [];
    const disposable = vscode.window.onDidChangeTerminalShellIntegration(
      async ({ terminal, shellIntegration }) => {
        if (terminal === targetTerminal) {
          for (const d of disposables) {
            d.dispose();
          }
          resolve(shellIntegration);
        }
      },
    );
    disposables.push(disposable);
    const timeout = setTimeout(() => {
      for (const d of disposables) {
        d.dispose();
      }
      resolve(undefined);
    }, 3000);

    disposables.push({
      dispose() {
        clearTimeout(timeout);
      },
    });
  });
}

const PochiTerminalName = "Pochi";
const PochiDevServerTerminalName = "Pochi (Dev Server)";

function findPochiTerminal(name: string) {
  for (const terminal of vscode.window.terminals) {
    if (terminal.name === name) {
      return terminal;
    }
  }
}

function createPochiTerminal(name: string, cwd?: string) {
  return vscode.window.createTerminal({
    name,
    cwd,
    iconPath: new vscode.ThemeIcon("terminal"),
    location: vscode.TerminalLocation.Panel,
  });
}

function getPochiShell(cwd?: string, isDevServer?: boolean) {
  const name = isDevServer ? PochiDevServerTerminalName : PochiTerminalName;
  const terminal = findPochiTerminal(name) || createPochiTerminal(name, cwd);
  terminal.show();

  return retrieveShellIntegration(terminal);
}
