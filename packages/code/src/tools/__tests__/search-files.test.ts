import fs from "node:fs/promises";
import { fileTypeFromFile } from "file-type";
import { describe, expect, it, vi } from "vitest";
import { searchFiles } from "../search-files";

vi.mock("node:fs/promises");
vi.mock("../file-utils", () => ({
  traverseBFS: vi.fn(async () => ({
    files: ["test-file.txt"],
  })),
}));
vi.mock("file-type", () => ({
  fileTypeFromFile: vi.fn(async () => ({ mime: "text/plain" })),
}));

describe("searchFiles", () => {
  it("should find matches for a given regex in a text file", async () => {
    const mockReadFile = vi.mocked(fs.readFile);
    const mockFileContent = "hello world\nthis is a test\nhello again";
    mockReadFile.mockResolvedValue(Buffer.from(mockFileContent));

    const result = await searchFiles({
      path: "test-path",
      regex: "hello",
      filePattern: ".txt",
    });

    expect(result.matches).toEqual([
      { file: "test-file.txt", line: 1, context: "hello world" },
      { file: "test-file.txt", line: 3, context: "hello again" },
    ]);
  });
});

it("should return no matches if the regex does not match any content", async () => {
  const mockReadFile = vi.mocked(fs.readFile);
  const mockFileContent = "hello world\nthis is a test\nhello again";
  mockReadFile.mockResolvedValue(Buffer.from(mockFileContent));

  const result = await searchFiles({
    path: "test-path",
    regex: "notfound",
    filePattern: ".txt",
  });

  expect(result.matches).toEqual([]);
});

it("should skip files with non-text MIME types", async () => {
  const mockReadFile = vi.mocked(fs.readFile);
  const mockFileContent = "binary data";
  mockReadFile.mockResolvedValue(Buffer.from(mockFileContent));

  const mockFileTypeFromFile = vi.mocked(fileTypeFromFile);
  mockFileTypeFromFile.mockResolvedValue({
    mime: "application/octet-stream",
    ext: "",
  });

  const result = await searchFiles({
    path: "test-path",
    regex: "data",
    filePattern: ".bin",
  });

  expect(result.matches).toEqual([]);
});

it("should handle empty files gracefully", async () => {
  const mockReadFile = vi.mocked(fs.readFile);
  const mockFileContent = "";
  mockReadFile.mockResolvedValue(Buffer.from(mockFileContent));

  const result = await searchFiles({
    path: "test-path",
    regex: "anything",
    filePattern: ".txt",
  });

  expect(result.matches).toEqual([]);
});

it("should handle invalid regex patterns gracefully", async () => {
  const mockReadFile = vi.mocked(fs.readFile);
  const mockFileContent = "hello world\nthis is a test\nhello again";
  mockReadFile.mockResolvedValue(Buffer.from(mockFileContent));

  await expect(
    searchFiles({
      path: "test-path",
      regex: "[invalid",
      filePattern: ".txt",
    }),
  ).rejects.toThrow(SyntaxError);
});
