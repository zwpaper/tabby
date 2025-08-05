export const getShellPath = () => {
  if (process.platform === "win32") {
    const defaultShell = process.env.ComSpec;
    if (defaultShell) {
      return defaultShell;
    }
    return "powershell.exe";
  }
  if (process.platform === "linux" || process.platform === "darwin") {
    const defaultShell = process.env.SHELL;
    if (defaultShell && /(bash|zsh)$/.test(defaultShell)) {
      return defaultShell;
    }
    return "/bin/bash";
  }
  return undefined;
};

export const buildShellCommand = (
  commandString: string,
):
  | {
      command: string;
      args: string[];
    }
  | undefined => {
  const shellPath = getShellPath();

  if (shellPath) {
    // Determine shell type and appropriate arguments using RegExp for precise matching
    const shellName = shellPath.toLowerCase();
    if (/powershell(\.exe)?$|pwsh(\.exe)?$/.test(shellName)) {
      return {
        command: shellPath,
        args: ["-Command", commandString],
      };
    }

    if (/cmd(\.exe)?$/.test(shellName)) {
      return {
        command: shellPath,
        args: ["/d", "/s", "/c", commandString],
      };
    }

    if (/(bash|zsh)$/.test(shellName)) {
      return {
        command: shellPath,
        args: ["-c", commandString],
      };
    }
  }

  return undefined;
};

export const fixExecuteCommandOutput = (output: string): string => {
  // Ensure CRLF ('\r\n') as line separator, '\n' only moves the cursor one line down but not to the beginning
  return output.replace(/(?<!\r)\n/g, "\r\n");
};
