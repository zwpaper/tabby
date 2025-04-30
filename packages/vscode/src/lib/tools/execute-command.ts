import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import * as vscode from "vscode";

let current:
  | {
      terminal: vscode.Terminal;
      shell: vscode.TerminalShellIntegration | undefined;
    }
  | undefined = undefined;

export const initExecuteCommandTool = () => {
  return vscode.window.onDidCloseTerminal((terminal) => {
    if (terminal === current?.terminal) {
      current = undefined;
    }
  });
};

export const executeCommand: ToolFunctionType<
  ClientToolsType["executeCommand"]
> = async ({ command, cwd }) => {
  if (!command) {
    throw new Error("Command is required to execute.");
  }

  if (!current) {
    const terminal = vscode.window.createTerminal({
      name: "Pochi",
      cwd,
      iconPath: new vscode.ThemeIcon("terminal"),
      location: vscode.TerminalLocation.Panel,
    });
    terminal.show();

    const shell = await retrieveShellIntegration(terminal);
    current = {
      terminal,
      shell,
    };
  }

  if (!current.shell) {
    // cannot get shell integration, send command directly without reading output
    current.terminal.sendText(`cd ${cwd}`);
    current.terminal.sendText(command);
    return { output: "" };

    // FIXME: using node process as a fallback
  }

  if (cwd && current.shell.cwd?.path !== cwd) {
    current.shell.executeCommand(`cd ${cwd}`);
  }

  const execution = current.shell.executeCommand(command);
  const outputStream = execution.read();
  let output = "";
  for await (const data of outputStream) {
    output += data;
  }

  return { output };
};

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
          for (const disposable of disposables) {
            disposable.dispose();
          }
          resolve(shellIntegration);
        }
      },
    );
    disposables.push(disposable);
    const timeout = setTimeout(() => {
      for (const disposable of disposables) {
        disposable.dispose();
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
