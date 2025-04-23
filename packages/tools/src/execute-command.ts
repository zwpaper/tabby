import { exec } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { type ToolFunctionType, defineClientTool } from "./types";

const execPromise = promisify(exec);

export const { tool: executeCommand, execute: executeExecuteCommand } =
  defineClientTool({
    description:
      "Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task.",
    inputSchema: z.object({
      command: z
        .string()
        .describe(
          "The CLI command to execute. This should be valid for the current operating system.",
        ),
      cwd: z
        .string()
        .optional()
        .describe("The working directory to execute the command in."),
    }),
    outputSchema: z.object({
      output: z
        .string()
        .describe("The output of the command (including stdout and stderr)."),
    }),
    execute: async ({ command, cwd }, { abortSignal }) => {
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
    },
  });

export type ExecuteCommandFunctionType = ToolFunctionType<
  typeof executeCommand
>;
