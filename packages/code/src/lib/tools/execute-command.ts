import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import type { ExecuteCommandFunctionType } from "@ragdoll/tools";
import stripAnsi from "strip-ansi";
import { getCommandPaneId, getServerPaneId } from "../window-manager"; // Import getServerPaneId
import type { AbortableFunctionType } from "./types";

const execPromise = promisify(exec);

/**
 * Finds an existing right pane or creates a new one
 * @returns The ID of the tmux pane to use
 */

/**
 * Alternative implementation using tmux pipe-pane for more reliable output capture
 */
async function tmuxPipePaneExecuteCommand(
  command: string,
  cwd?: string,
  signal?: AbortSignal,
): Promise<{ output: string }> {
  // Create a temporary file to capture output
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tmux-pipe-"));
  const outputFile = path.join(tmpDir, "output.log");
  const exitCodeFile = path.join(tmpDir, "exit-code");
  const paneIdFile = path.join(tmpDir, "pane-id");
  const scriptFile = path.join(tmpDir, "wrapper.sh");

  // Get or create a tmux pane
  const paneId = await getCommandPaneId();
  await fs.writeFile(paneIdFile, paneId);

  // Set up pipe-pane to capture output
  await execPromise(`tmux pipe-pane -t ${paneId} "cat > ${outputFile}"`);

  const workingDir = cwd || process.cwd();
  // Create wrapper script to execute the command
  const scriptContent = `#!/bin/bash
# Wrapper script for command execution with proper capture

# Change directory if specified
${workingDir ? `cd "${workingDir}" || { echo "Failed to change to directory: ${workingDir}"; exit 1; }` : ""}

export PAGER=""

# Execute the main command
${command} < /dev/null

# Save exit code
echo $? > "${exitCodeFile}"

# Small delay to ensure output is captured
sleep 1
`;

  // Write script to file and make it executable
  await fs.writeFile(scriptFile, scriptContent);
  await fs.chmod(scriptFile, 0o755);

  // Send wrapper script to the pane
  await execPromise(`tmux send-keys -t ${paneId} "${scriptFile}" Enter`);

  // Wait for the command to finish by checking for exit code file

  let exitCode = 0;
  while (true) {
    if (signal?.aborted) {
      // Don't kill the pane if we're reusing it, just send Ctrl+C to interrupt the command
      try {
        await execPromise(`tmux send-keys -t ${paneId} C-c`);
        // Cancel the pipe-pane
        await execPromise(`tmux pipe-pane -t ${paneId}`);
      } catch (err) {
        // Ignore errors when trying to interrupt the command
      }
      throw new Error("Command execution aborted");
    }

    try {
      // Check if exit code file exists
      await fs.access(exitCodeFile);

      exitCode = Number.parseInt(await fs.readFile(exitCodeFile, "utf-8"), 10);

      // Stop pipe-pane capture (don't kill the pane since we're reusing it)
      await execPromise(`tmux pipe-pane -t ${paneId}`)
        // Ignore errors when trying to stop pipe-pane
        .catch(() => {});

      break;
    } catch (err) {
      // File doesn't exist yet, wait and retry
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Read captured output
  let stdout = "";
  try {
    stdout = await fs.readFile(outputFile, "utf-8");
    // Strip ANSI escape codes
    stdout = postProcessTmuxOutput(stdout);
  } catch (err) {
    // If file doesn't exist, leave stdout as empty string
  }

  // Always return exitCode 0 as requested
  return { output: `Exit code: ${exitCode}\n\n${stdout}` };
}

function postProcessTmuxOutput(output: string): string {
  // Strip ANSI escape codes
  const strippedOutput = stripAnsi(output).replaceAll("\x1B\\", "\r\n");
  const lines = strippedOutput.split("\r\n").map((line) => line.trim());
  const lastWrapperScriptIndex = lines.findLastIndex((line) =>
    line.match(/.*tmux-pipe.*wrapper.sh/),
  );
  return lines.slice(lastWrapperScriptIndex + 1).join("\r\n");
}

export const executeCommand: AbortableFunctionType<
  ExecuteCommandFunctionType
> = async ({ command, cwd, isDevServer }, signal) => {
  if (!command) {
    throw new Error("Command is required to execute.");
  }

  if (!process.env.TMUX) {
    throw new Error("executeCommand is only supported in tmux.");
  }

  if (!isDevServer) {
    return await tmuxPipePaneExecuteCommand(command, cwd, signal);
  }

  // Get the dedicated server pane ID
  const serverPaneId = await getServerPaneId();

  // Construct the command to be sent, including changing directory if needed
  const commandToSend = cwd ? `cd "${cwd}" && ${command}` : command;

  // Send the command to the server pane
  await execPromise(
    `tmux send-keys -t ${serverPaneId} "${commandToSend.replace(/"/g, '\\"')}" Enter`,
  );

  // For dev servers, we don't wait for output. Return immediately.
  // Consider adding a mechanism to monitor the server pane if needed later.
  return { output: `"${command}" started as dev server.` };
};
