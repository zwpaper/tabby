import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execAsyncMock } = vi.hoisted(() => {
  return { execAsyncMock: vi.fn() };
});

vi.mock("node:util", () => ({
  promisify: vi.fn().mockReturnValue(execAsyncMock),
}));

import { searchFilesWithRipgrep } from "../ripgrep";

describe("searchFilesWithRipgrep", () => {
  const rgPath = "/usr/bin/rg";
  const workspacePath = "/workspace";

  beforeEach(() => {
    execAsyncMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return matches for a successful search", async () => {
    const mockRgOutput = [
      {
        type: "match",
        data: {
          path: { text: "/workspace/src/index.ts" },
          lines: { text: "console.log('hello world');\n" },
          line_number: 10,
        },
      },
      {
        type: "match",
        data: {
          path: { text: "/workspace/src/app.ts" },
          lines: { text: "console.log('hello');\n" },
          line_number: 5,
        },
      },
    ]
      .map((o) => JSON.stringify(o))
      .join("\n");

    execAsyncMock.mockResolvedValue({ stdout: mockRgOutput, stderr: "" });

    const result = await searchFilesWithRipgrep(
      ".",
      "hello",
      rgPath,
      workspacePath,
    );

    expect(result.matches).toEqual([
      {
        file: "src/index.ts",
        line: 10,
        context: "console.log('hello world');",
      },
      {
        file: "src/app.ts",
        line: 5,
        context: "console.log('hello');",
      },
    ]);
    expect(result.isTruncated).toBe(false);
    expect(execAsyncMock).toHaveBeenCalledWith(
      `"/usr/bin/rg" --json --case-sensitive --binary --sortr modified 'hello' '/workspace'`,
      expect.any(Object),
    );
  });

  it("should return an empty array when no matches are found", async () => {
    execAsyncMock.mockRejectedValue({ code: 1, stdout: "", stderr: "" });

    const result = await searchFilesWithRipgrep(
      ".",
      "no-match",
      rgPath,
      workspacePath,
    );

    expect(result.matches).toEqual([]);
    expect(result.isTruncated).toBe(false);
  });

  it("should include filePattern in the command when provided", async () => {
    execAsyncMock.mockResolvedValue({ stdout: "", stderr: "" });

    await searchFilesWithRipgrep(
      ".",
      "hello",
      rgPath,
      workspacePath,
      "**/*.ts",
    );

    expect(execAsyncMock).toHaveBeenCalledWith(
      `"/usr/bin/rg" --json --case-sensitive --binary --sortr modified --glob '**/*.ts' 'hello' '/workspace'`,
      expect.any(Object),
    );
  });

  it("should truncate results if matches exceed MaxRipgrepItems", async () => {
    const mockRgOutput = Array.from({ length: 501 }, (_, i) => ({
      type: "match",
      data: {
        path: { text: `/workspace/file${i}.ts` },
        lines: { text: `line ${i}\n` },
        line_number: i + 1,
      },
    }))
      .map((o) => JSON.stringify(o))
      .join("\n");

    execAsyncMock.mockResolvedValue({ stdout: mockRgOutput, stderr: "" });

    const result = await searchFilesWithRipgrep(
      ".",
      "hello",
      rgPath,
      workspacePath,
    );

    expect(result.matches.length).toBe(500);
    expect(result.isTruncated).toBe(true);
  });

  it("should throw an error when rg fails with code > 1", async () => {
    const mockError = {
      code: 2,
      stderr: "A critical error occurred",
    };
    execAsyncMock.mockRejectedValue(mockError);

    await expect(
      searchFilesWithRipgrep(".", "error", rgPath, workspacePath),
    ).rejects.toThrow(`rg command failed with code 2: A critical error occurred`);
  });

  it("should handle JSON parsing errors gracefully", async () => {
    const mockRgOutput =
      'invalid-json\n' +
      JSON.stringify({
        type: "match",
        data: {
          path: { text: "/workspace/src/app.ts" },
          lines: { text: "console.log('hello');\n" },
          line_number: 5,
        },
      });

    execAsyncMock.mockResolvedValue({ stdout: mockRgOutput, stderr: "" });

    const result = await searchFilesWithRipgrep(
      ".",
      "hello",
      rgPath,
      workspacePath,
    );

    expect(result.matches.length).toBe(1);
    expect(result.matches[0].file).toBe("src/app.ts");
  });

  it("should handle exit code 1 with stdout", async () => {
    const mockRgOutput = JSON.stringify({
      type: "match",
      data: {
        path: { text: "/workspace/src/app.ts" },
        lines: { text: "console.log('hello');\n" },
        line_number: 5,
      },
    });
    const mockError = {
      code: 1,
      stdout: mockRgOutput,
      stderr: "A non-fatal error occurred",
    };
    execAsyncMock.mockRejectedValue(mockError);

    const result = await searchFilesWithRipgrep(
      ".",
      "hello",
      rgPath,
      workspacePath,
    );

    // The current implementation does not process stdout on error, so matches will be empty
    // This test just ensures the function doesn't crash and handles the error path correctly.
    expect(result.matches).toEqual([]);
  });

  it("should rethrow an unexpected error", async () => {
    const unexpectedError = new Error("Unexpected error");
    execAsyncMock.mockRejectedValue(unexpectedError);

    await expect(
      searchFilesWithRipgrep(".", "error", rgPath, workspacePath),
    ).rejects.toThrow("Unexpected error");
  });
});
