import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileResult } from "../ignore-walk";
import { globFiles } from "../glob-files";
import { ignoreWalk } from "../ignore-walk";

vi.mock("../ignore-walk", async () => ({
  ignoreWalk: vi.fn(),
}));

describe("globFiles", () => {
  const cwd = "/workspace";
  const mockFiles: FileResult[] = [
    { filepath: "/workspace/src/index.ts", relativePath: "src/index.ts", isDir: false },
    { filepath: "/workspace/src/components/button.tsx", relativePath: "src/components/button.tsx", isDir: false },
    { filepath: "/workspace/src/components/modal.tsx", relativePath: "src/components/modal.tsx", isDir: false },
    { filepath: "/workspace/README.md", relativePath: "README.md", isDir: false },
  ];

  beforeEach(() => {
    vi.mocked(ignoreWalk).mockResolvedValue(mockFiles);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should find all tsx files", async () => {
    const result = await globFiles({
      cwd,
      path: ".",
      globPattern: "**/*.tsx",
    });
    expect(result.files).toEqual([
      path.join(".", "src/components/button.tsx"),
      path.join(".", "src/components/modal.tsx"),
    ]);
    expect(result.isTruncated).toBe(false);
  });

  it("should handle no matching files", async () => {
    const result = await globFiles({
      cwd,
      path: ".",
      globPattern: "**/*.css",
    });
    expect(result.files).toEqual([]);
    expect(result.isTruncated).toBe(false);
  });

  it("should return an empty array when ignoreWalk returns no files", async () => {
    vi.mocked(ignoreWalk).mockResolvedValue([]);
    const result = await globFiles({
      cwd,
      path: ".",
      globPattern: "**/*",
    });
    expect(result.files).toEqual([]);
  });

  it("should throw an error if ignoreWalk fails", async () => {
    const mockError = new Error("Failed to walk directory");
    vi.mocked(ignoreWalk).mockRejectedValue(mockError);
    await expect(
      globFiles({
        cwd,
        path: ".",
        globPattern: "**/*",
      }),
    ).rejects.toThrow("Failed to glob files: Failed to walk directory");
  });

  it("should truncate results when the number of files exceeds MaxGlobFileItems", async () => {
    const largeMockFiles: FileResult[] = Array.from({ length: 501 }, (_, i) => ({
      filepath: `/workspace/file${i}.ts`,
      relativePath: `file${i}.ts`,
      isDir: false,
    }));

    vi.mocked(ignoreWalk).mockResolvedValue(largeMockFiles);

    const result = await globFiles({
      cwd,
      path: ".",
      globPattern: "**/*.ts",
    });

    expect(result.files.length).toBe(500);
    expect(result.isTruncated).toBe(true);
  });
});

