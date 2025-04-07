import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ExecuteCommandFunctionType } from "@ragdoll/tools";
import type { AbortableFunctionType } from "./types";

const execPromise = promisify(exec);

export const executeCommand: AbortableFunctionType<
  ExecuteCommandFunctionType
> = async ({ command, cwd }, signal) => {
  if (!command) {
    throw new Error("Command is required to execute.");
  }

  try {
    const { stdout, stderr } = await execPromise(command, { cwd, signal });
    return {
      exitCode: 0,
      stdout,
      stderr,
    };
  } catch (error: unknown) {
    // Type guard for the expected error structure from execPromise
    if (
      error &&
      typeof error === "object" &&
      "stdout" in error &&
      "stderr" in error &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "number"
    ) {
      const execError = error as {
        stdout: string;
        stderr: string;
        code: number;
      };
      return {
        stdout: execError.stdout,
        stderr: execError.stderr,
        exitCode: execError.code,
      };
    }
    // Re-throw if it's not the expected error structure or rethrow with more context
    throw error;
  }
};
