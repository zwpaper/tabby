export const getShellPath = () => {
  const defaultShell = process.env.SHELL ?? "";

  const shellPath = ["/zsh", "/bash"].some((item) =>
    defaultShell.endsWith(item),
  )
    ? defaultShell
    : ["linux", "darwin"].includes(process.platform)
      ? "/bin/bash"
      : undefined;

  return shellPath;
};

export const fixExecuteCommandOutput = (output: string): string => {
  // Ensure CRLF ('\r\n') as line separator, '\n' only moves the cursor one line down but not to the beginning
  return output.replace(/(?<!\r)\n/g, "\r\n");
};
