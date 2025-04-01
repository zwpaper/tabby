import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { traverseBFS } from "../file-utils";

vi.mock("node:fs/promises");
vi.mock("node:path", () => ({
  join: vi.fn((...args) => args.join("/")),
}));

describe("traverseBFS", () => {
  it("should traverse a directory non-recursively", async () => {
    vi.mocked(readdir).mockResolvedValueOnce([
      {
        name: "file1.txt",
        isFile: () => true,
        isDirectory: () => false,
      } as Dirent,
      {
        name: "subdir",
        isFile: () => false,
        isDirectory: () => true,
      } as Dirent,
    ]);

    const result = await traverseBFS("/test", false);
    expect(result).toEqual({
      files: ["/test/file1.txt", "/test/subdir"],
      isTruncated: false,
    });
  });

  it("should traverse a directory recursively", async () => {
    vi.mocked(readdir)
      .mockResolvedValueOnce([
        {
          name: "file1.txt",
          isFile: () => true,
          isDirectory: () => false,
        } as Dirent,
        {
          name: "subdir",
          isFile: () => false,
          isDirectory: () => true,
        } as Dirent,
      ])
      .mockResolvedValueOnce([
        {
          name: "file2.txt",
          isFile: () => true,
          isDirectory: () => false,
        } as Dirent,
      ]);

    const result = await traverseBFS("/test", true);
    expect(result).toEqual({
      files: ["/test/file1.txt", "/test/subdir", "/test/subdir/file2.txt"],
      isTruncated: false,
    });
  });

  it("should handle ignored directories", async () => {
    vi.mocked(readdir).mockResolvedValueOnce([
      {
        name: "node_modules",
        isFile: () => false,
        isDirectory: () => true,
      } as Dirent,
      {
        name: "file1.txt",
        isFile: () => true,
        isDirectory: () => false,
      } as Dirent,
    ]);

    const result = await traverseBFS("/test", true);
    expect(result).toEqual({
      files: ["/test/file1.txt"],
      isTruncated: false,
    });
  });

  it("should limit the number of items with maxItems", async () => {
    vi.mocked(readdir).mockResolvedValueOnce([
      {
        name: "file1.txt",
        isFile: () => true,
        isDirectory: () => false,
      } as Dirent,
      {
        name: "file2.txt",
        isFile: () => true,
        isDirectory: () => false,
      } as Dirent,
    ]);

    const result = await traverseBFS("/test", true, 1);
    expect(result).toEqual({
      files: ["/test/file1.txt"],
      isTruncated: true,
    });
  });

  it("should return an empty result for an empty directory", async () => {
    vi.mocked(readdir).mockResolvedValueOnce([]);

    const result = await traverseBFS("/test", true);
    expect(result).toEqual({
      files: [],
      isTruncated: false,
    });
  });
});
