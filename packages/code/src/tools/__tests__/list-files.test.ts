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
});
