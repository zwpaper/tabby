import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import type { ExecuteCommandFunctionType } from "@ragdoll/tools";
import stripAnsi from "strip-ansi";
import type { AbortableFunctionType } from "./types";

const execPromise = promisify(exec);

/**
 * Finds an existing right pane or creates a new one
 * @returns The ID of the tmux pane to use
 */
async function findOrCreateRightPane(): Promise<string> {
  try {
    // Get pane information including position and count
    const { stdout: paneList } = await execPromise(
      'tmux list-panes -F "#{pane_id}:#{pane_at_right}:#{pane_index}:#{window_panes}"',
    );

    // Parse pane information and find a proper right pane (if it exists)
    const panes = paneList
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const [id, atRight, index, totalPanes] = line.split(":");
        return {
          id,
          atRight: atRight === "1",
          index: Number.parseInt(index, 10),
          totalPanes: Number.parseInt(totalPanes, 10),
        };
      });

    // Find an actual right pane - must have atRight=true AND multiple panes must exist
    const rightPane = panes.find((pane) => pane.atRight && pane.totalPanes > 1);

    if (rightPane) {
      // Reuse existing right pane
      const paneId = rightPane.id;

      // Clear the pane
      await execPromise(`tmux send-keys -t ${paneId} C-c`); // Send Ctrl+C to interrupt any running command
      await execPromise(`tmux send-keys -t ${paneId} "clear" Enter`);
      return paneId;
    }
    // No right pane found, create a new one
    const { stdout: newPaneId } = await execPromise(
      'tmux split-window -h -d -P -F "#{pane_id}"',
    );
    return newPaneId.trim();
  } catch (err) {
    // Fallback to creating a new pane if there's any issue detecting existing panes
    const { stdout: newPaneId } = await execPromise(
      'tmux split-window -h -d -P -F "#{pane_id}"',
    );
    return newPaneId.trim();
  }
}

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
  const paneId = await findOrCreateRightPane();
  await fs.writeFile(paneIdFile, paneId);

  // Set up pipe-pane to capture output
  await execPromise(`tmux pipe-pane -t ${paneId} "cat > ${outputFile}"`);

  // Create wrapper script to execute the command
  const scriptContent = `#!/bin/bash
# Wrapper script for command execution with proper capture

# Change directory if specified
${cwd ? `cd "${cwd}" || { echo "Failed to change to directory: ${cwd}"; exit 1; }` : ""}

# Execute the main command
${command}

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
> = async ({ command, cwd }, signal) => {
  if (!command) {
    throw new Error("Command is required to execute.");
  }

  const interactive = !!process.env.TMUX;

  if (interactive) {
    // Choose between the two tmux implementation methods
    return await tmuxPipePaneExecuteCommand(command, cwd, signal);
  }

  let result: { exitCode: number; stdout: string; stderr: string };
  try {
    const { stdout, stderr } = await execPromise(command, { cwd, signal });
    result = {
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
      const { stdout, stderr, code } = error as {
        stdout: string;
        stderr: string;
        code: number;
      };
      result = {
        exitCode: code,
        stdout,
        stderr,
      };
    } else {
      // Re-throw if it's not the expected error structure or rethrow with more context
      throw error;
    }
  }

  return {
    output: `Exit code ${result.exitCode}\n\n${result.stdout}\n${result.stderr}`,
  };
};
