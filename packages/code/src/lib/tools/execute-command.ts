import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ExecuteCommandFunctionType } from "@ragdoll/tools";

const execPromise = promisify(exec);

export const executeCommand: ExecuteCommandFunctionType = async ({
  command,
  cwd,
}) => {
  if (!command) {
    throw new Error("Command is required to execute.");
  }

  try {
    const { stdout, stderr } = await execPromise(command, { cwd });
    return {
      exitCode: 0,
      stdout,
      stderr,
    };
  } catch (error: any) {
    const { stdout, stderr, code } = error;
    return { stdout, stderr, exitCode: code }
  }
};
