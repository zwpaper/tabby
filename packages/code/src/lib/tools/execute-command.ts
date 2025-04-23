import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ExecuteCommandFunctionType } from "@ragdoll/tools";

const execPromise = promisify(exec);

export const executeCommand: ExecuteCommandFunctionType = async (
  { command, cwd },
  { abortSignal },
) => {
  if (!command) {
    throw new Error("Command is required to execute.");
  }

  let output = "";
  try {
    const { stdout, stderr } = await execPromise(command, {
      cwd,
      signal: abortSignal,
    });
    output = `Exit code: 0\n\n${stdout}\n${stderr}`;
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      "stdout" in err &&
      "stderr" in err
    ) {
      output = `Exit code: ${err.code}\n\n${err.stdout}\n${err.stderr}`;
    } else {
      throw err;
    }
  }

  return { output };
};
