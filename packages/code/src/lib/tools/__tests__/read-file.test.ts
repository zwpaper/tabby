import fs from "node:fs/promises";
import * as fileType from "file-type";
import { describe, expect, it, vi } from "vitest";
import { readFile } from "../read-file";

vi.mock("node:fs/promises");
vi.mock("file-type");

describe("readFile", () => {
  it("should read the content of a file successfully", async () => {
    const mockReadFile = vi.mocked(fs.readFile);
    const mockFileContent = "This is a test file content.";
    mockReadFile.mockResolvedValueOnce(mockFileContent);

    const mockFileTypeFromFile = vi.mocked(fileType.fileTypeFromFile);
    mockFileTypeFromFile.mockResolvedValue({ mime: "text/plain" } as any);

    const result = await readFile({ path: "test-file.txt" });

    // Expect line number 1 prepended
    expect(result.content).toBe(`1 | ${mockFileContent}`);
    expect(mockReadFile).toHaveBeenCalledWith("test-file.txt");
  });

  it("should throw an error if the file is binary", async () => {
    const mockFileTypeFromFile = vi.mocked(fileType.fileTypeFromFile);
    mockFileTypeFromFile.mockResolvedValue({
      mime: "application/octet-stream",
    } as any);

    await expect(readFile({ path: "binary-file.bin" })).rejects.toThrow(
      "The file is binary or not plain text (detected type: application/octet-stream).",
    );
  });

  it("should read a specific range of lines", async () => {
    const mockReadFile = vi.mocked(fs.readFile);
    const mockFileTypeFromFile = vi.mocked(fileType.fileTypeFromFile);
    mockFileTypeFromFile.mockResolvedValue({ mime: "text/plain" } as any);

    const fileContent = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";
    mockReadFile.mockResolvedValue(fileContent);

    const result = await readFile({
      path: "test-file.txt",
      startLine: 2,
      endLine: 4, // Reads lines 2, 3, 4 (exclusive end index for slice, but inclusive for user input)
    });

    // Expect line numbers 2, 3, 4 prepended
    expect(result.content).toBe("2 | Line 2\n3 | Line 3\n4 | Line 4");
  });

  it("should truncate content exceeding 1 MB", async () => {
    const mockReadFile = vi.mocked(fs.readFile);
    const mockFileTypeFromFile = vi.mocked(fileType.fileTypeFromFile);
    mockFileTypeFromFile.mockResolvedValue({ mime: "text/plain" } as any);

    // Create large content (e.g., 2MB)
    const largeContentLine = "A".repeat(100);
    const numLines = Math.ceil(2_000_000 / (largeContentLine.length + 1)); // +1 for newline
    const largeContent = Array(numLines).fill(largeContentLine).join("\n");

    mockReadFile.mockResolvedValue(largeContent);

    const result = await readFile({ path: "large-file.txt" });

    // Check if the byte length is within the limit (accounting for line numbers)
    expect(Buffer.byteLength(result.content, "utf-8")).toBeLessThanOrEqual(
      1_048_576,
    );
    expect(result.isTruncated).toBe(true);

    // Also check that the first line has the correct line number format
    expect(result.content.startsWith("1 | ")).toBe(true);
  });

  it("should throw an error if the file does not exist", async () => {
    // Mock fileTypeFromFile to simulate file check before fs.readFile
    const mockFileTypeFromFile = vi.mocked(fileType.fileTypeFromFile);
    // Simulate fs.readFile throwing the error if fileType check passes or is skipped
    const mockReadFile = vi.mocked(fs.readFile);

    // Option 1: fileTypeFromFile throws (e.g., permission error before reading)
    // mockFileTypeFromFile.mockRejectedValue(new Error("File not found or inaccessible"));

    // Option 2: fs.readFile throws (more common for 'not found')
    mockFileTypeFromFile.mockResolvedValue({ mime: "text/plain" } as any); // Assume it looks like a text file initially
    mockReadFile.mockRejectedValue(
      new Error("ENOENT: no such file or directory"),
    ); // Simulate fs error

    await expect(readFile({ path: "non-existent-file.txt" })).rejects.toThrow(); // Check for any error related to file access/reading
  });
});
