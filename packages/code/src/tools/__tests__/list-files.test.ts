import fs from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { listFiles } from "../list-files";

vi.mock("node:fs/promises");

describe("listFiles", () => {
  it("should list all files in a directory", async () => {
    const mockReaddir = vi.mocked(fs.readdir);
    const mockStat = vi.mocked(fs.stat);
    mockReaddir.mockResolvedValue([
      {
        name: "file1.txt",
        isDirectory: () => false,
        isFile: () => true,
      } as any,
      {
        name: "file2.txt",
        isDirectory: () => false,
        isFile: () => true,
      } as any,
      { name: "subdir", isDirectory: () => true, isFile: () => false } as any,
    ]);
    mockStat.mockResolvedValueOnce({ isDirectory: () => false } as any);
    mockStat.mockResolvedValueOnce({ isDirectory: () => false } as any);
    mockStat.mockResolvedValueOnce({ isDirectory: () => true } as any);

    const result = await listFiles({ path: "test-dir", recursive: false });

    expect(result.files).toEqual(["test-dir/file1.txt", "test-dir/file2.txt"]);
    expect(mockReaddir).toHaveBeenCalledWith("test-dir", {
      withFileTypes: true,
    });
  });

  it("should list files recursively in a directory", async () => {
    const mockReaddir = vi.mocked(fs.readdir);
    const mockStat = vi.mocked(fs.stat);
    mockReaddir.mockResolvedValueOnce([
      {
        name: "file1.txt",
        isDirectory: () => false,
        isFile: () => true,
      } as any,
      { name: "subdir", isDirectory: () => true, isFile: () => false } as any,
    ]);
    mockReaddir.mockResolvedValueOnce([
      {
        name: "file2.txt",
        isDirectory: () => false,
        isFile: () => true,
      } as any,
    ]);
    mockStat.mockResolvedValueOnce({ isDirectory: () => false } as any);
    mockStat.mockResolvedValueOnce({ isDirectory: () => true } as any);
    mockStat.mockResolvedValueOnce({ isDirectory: () => false } as any);

    const result = await listFiles({ path: "test-dir", recursive: true });

    expect(result.files).toEqual([
      "test-dir/file1.txt",
      "test-dir/subdir/file2.txt",
    ]);
    expect(mockReaddir).toHaveBeenCalledWith("test-dir", {
      withFileTypes: true,
    });
    expect(mockReaddir).toHaveBeenCalledWith("test-dir/subdir", {
      withFileTypes: true,
    });
  });

  it("should return an empty array if the directory is empty", async () => {
    const mockReaddir = vi.mocked(fs.readdir);
    mockReaddir.mockResolvedValue([]);

    const result = await listFiles({ path: "empty-dir", recursive: false });

    expect(result.files).toEqual([]);
    expect(mockReaddir).toHaveBeenCalledWith("empty-dir", {
      withFileTypes: true,
    });
  });
});
