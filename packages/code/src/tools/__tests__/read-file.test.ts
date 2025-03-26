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

    expect(result.content).toBe(mockFileContent);
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
      endLine: 4,
    });

    expect(result.content).toBe("Line 2\nLine 3\nLine 4");
  });

  it("should truncate content exceeding 1 MB", async () => {
    const mockReadFile = vi.mocked(fs.readFile);
    const mockFileTypeFromFile = vi.mocked(fileType.fileTypeFromFile);
    mockFileTypeFromFile.mockResolvedValue({ mime: "text/plain" } as any);

    const largeContent = "A".repeat(2_000_000); // 2 MB content
    mockReadFile.mockResolvedValue(largeContent);

    const result = await readFile({ path: "large-file.txt" });

    expect(result.content.length).toBeLessThanOrEqual(1_048_576);
    expect(result.isTruncated).toBe(true);
  });

  it("should throw an error if the file does not exist", async () => {
    const mockFileTypeFromFile = vi.mocked(fileType.fileTypeFromFile);
    mockFileTypeFromFile.mockRejectedValue(new Error("File not found"));

    await expect(readFile({ path: "non-existent-file.txt" })).rejects.toThrow(
      "File not found",
    );
  });
});
