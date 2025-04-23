import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyDiff } from "../apply-diff";

vi.mock("node:fs/promises");

describe("applyDiff", () => {
  const mockFilePath = "mock-file.txt";
  const mockFileContent = "line1\nline2\nline3\nline4\nline5";
  const validDiff =
    "<<<<<<< SEARCH\nline2\n=======\nupdated-line2\n>>>>>>> REPLACE";

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock readFile for most tests, specific tests can override
    vi.mocked(fs.readFile).mockResolvedValue(mockFileContent);
  });

  it("should apply the diff successfully", async () => {
    const mockWriteFile = vi.mocked(fs.writeFile).mockResolvedValue();

    const result = await applyDiff(
      {
        path: mockFilePath,
        diff: validDiff,
        startLine: 2,
        endLine: 2,
      },
      { toolCallId: "dummy", messages: [] },
    );

    expect(result).toEqual({ success: true });
    expect(mockWriteFile).toHaveBeenCalledWith(
      mockFilePath,
      "line1\nupdated-line2\nline3\nline4\nline5",
      "utf-8",
    );
  });

  it("should throw an error if search content does not match", async () => {
    const invalidDiff =
      "<<<<<<< SEARCH\nnon-matching-line\n=======\nupdated-line\n>>>>>>> REPLACE";

    await expect(
      applyDiff(
        {
          path: mockFilePath,
          diff: invalidDiff,
          startLine: 2,
          endLine: 2,
        },
        { toolCallId: "dummy", messages: [] },
      ),
    ).rejects.toThrow(
      "Search content does not match the original file content.",
    );
  });

  it("should throw an error for invalid diff format (missing separator)", async () => {
    const invalidDiffFormat = "invalid diff format";

    await expect(
      applyDiff(
        {
          path: mockFilePath,
          diff: invalidDiffFormat,
          startLine: 2,
          endLine: 2,
        },
        { toolCallId: "dummy", messages: [] },
      ),
    ).rejects.toThrow("Invalid diff format");
  });

  it("should throw an error for invalid diff format (missing SEARCH prefix)", async () => {
    const invalidDiffFormat =
      "SEARCH\nline2\n=======\nupdated-line2\n>>>>>>> REPLACE";

    await expect(
      applyDiff(
        {
          path: mockFilePath,
          diff: invalidDiffFormat,
          startLine: 2,
          endLine: 2,
        },
        { toolCallId: "dummy", messages: [] },
      ),
    ).rejects.toThrow(
      "Diff formatis incorrect. Expected '<<<<<<< SEARCH' prefix.",
    );
  });

  it("should throw an error for invalid diff format (missing REPLACE suffix)", async () => {
    const invalidDiffFormat =
      "<<<<<<< SEARCH\nline2\n=======\nupdated-line2\nREPLACE";

    await expect(
      applyDiff(
        {
          path: mockFilePath,
          diff: invalidDiffFormat,
          startLine: 2,
          endLine: 2,
        },
        { toolCallId: "dummy", messages: [] },
      ),
    ).rejects.toThrow(
      "Diff format is incorrect. Expected '>>>>>>> REPLACE' suffix.",
    );
  });

  it("should throw an error if the file does not exist", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));

    await expect(
      applyDiff(
        {
          path: mockFilePath,
          diff: validDiff,
          startLine: 2,
          endLine: 2,
        },
        { toolCallId: "dummy", messages: [] },
      ),
    ).rejects.toThrow("File not found");
  });

  it("should should work for an empty replace section", async () => {
    const diff = "<<<<<<< SEARCH\nline2\n=======\n>>>>>>> REPLACE";

    const result = await applyDiff(
      {
        path: mockFilePath,
        diff,
        startLine: 2,
        endLine: 2,
      },
      { toolCallId: "dummy", messages: [] },
    );

    expect(result.success).toBe(true);
  });
});
