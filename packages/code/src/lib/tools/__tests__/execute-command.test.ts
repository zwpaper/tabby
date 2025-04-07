import { describe, expect, it } from "vitest";
import { executeCommand } from "../execute-command";

describe("executeCommand", () => {
  const signal = new AbortController().signal;
  it("should execute a valid command and return stdout", async () => {
    const result = await executeCommand({
      command: "echo Hello, World!",
      requiresApproval: false,
      signal,
    });
    expect(result.stdout).toBe("Hello, World!\n");
  });

  it("should throw an error if command is missing", async () => {
    await expect(
      executeCommand({ command: "", requiresApproval: false, signal }),
    ).rejects.toThrow("Command is required to execute.");
  });

  it("should return stderr if the command fails", async () => {
    const result = await executeCommand({
      command: "invalid-command",
      requiresApproval: false,
      signal,
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("invalid-command: command not found");
  });

  it("should execute a command with a specified working directory", async () => {
    const result = await executeCommand({
      command: "pwd",
      cwd: "/",
      requiresApproval: false,
      signal,
    });
    expect(result.stdout.trim()).toBe("/");
  });
});
