import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { executeCommand } from "../execute-command";

describe("executeCommand", () => {
  // Simulate non-interactive environment for these tests
  // The interactive path (tmux) has a different output structure
  // which is harder to test reliably here.
  const originalTmuxEnv = process.env.TMUX;
  beforeAll(() => {
    process.env.TMUX = ""; // Disable tmux for testing non-interactive path
  });
  afterAll(() => {
    process.env.TMUX = originalTmuxEnv; // Restore original env var
  });

  const signal = new AbortController().signal;

  it("should execute a valid command and return structured output", async () => {
    const result = await executeCommand(
      {
        command: "echo Hello, World!",
        requiresApproval: false,
      },
      signal,
    );
    // Non-interactive path should return structured output
    expect(result.output).toBe("Exit code 0\n\nHello, World!\n\n");
  });

  it("should throw an error if command is missing", async () => {
    await expect(
      executeCommand({ command: "", requiresApproval: false }, signal),
    ).rejects.toThrow("Command is required to execute.");
  });

  it("should return structured output with stderr if the command fails", async () => {
    const result = await executeCommand(
      {
        command: "invalid-command",
        requiresApproval: false,
      },
      signal,
    );
    expect(result.output).toMatch(
      /invalid-command.*not found|command not found.*invalid-command/,
    );
  });

  it("should execute a command with a specified working directory", async () => {
    const result = await executeCommand(
      {
        command: "pwd", // Print Working Directory
        cwd: "/", // Execute in the root directory
        requiresApproval: false,
      },
      signal,
    );
    expect(result.output.trim()).toBe("Exit code 0\n\n/");
  });

  // Add a test case for the interactive (tmux) path if possible,
  // though mocking tmux behavior might be complex.
  // For now, we focus on the non-interactive path tested above.
});
