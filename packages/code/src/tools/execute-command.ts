import type { ExecuteCommandFunctionType } from "@ragdoll/tools";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execPromise = promisify(exec);

export const executeCommand: ExecuteCommandFunctionType = async ({
    command,
    cwd,
}) => {
    if (!command) {
        throw new Error("Command is required to execute.");
    }

    const { stdout, stderr } = await execPromise(command, { cwd });
    return {
        output: stdout || stderr,
    };
};