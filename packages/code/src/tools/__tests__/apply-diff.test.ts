import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyDiff } from "../apply-diff";

vi.mock("node:fs/promises");

describe("applyDiff", () => {
  const mockReadFile = vi.mocked(fs.readFile);
  const mockWriteFile = vi.mocked(fs.writeFile);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should apply the diff and write the updated content to the file", async () => {
    const filePath = "test-file.txt";
    const fileContent = "line1\nline2\nline3\nline4\nline5";
    const diff = `
<<<<<<< SEARCH
:start_line:2
:end_line:3
-------
line2
line3
=======
updatedLine2
updatedLine3
>>>>>>> REPLACE
<<<<<<< SEARCH
:start_line:3
:end_line:5
-------
line4
=======
updatedLine4
>>>>>>> REPLACE
`;

    mockReadFile.mockResolvedValue(fileContent);

    const result = await applyDiff({ path: filePath, diff });

    expect(result).toEqual({ success: true });
    expect(mockReadFile).toHaveBeenCalledWith(filePath, "utf-8");
    expect(mockWriteFile).toHaveBeenCalledWith(
      filePath,
      "line1\nupdatedLine2\nupdatedLine3\nupdatedLine4\nline5",
      "utf-8",
    );
  });

  it("should return false if the search content does not match", async () => {
    const filePath = "test-file.txt";
    const fileContent = "line1\nline2\nline3\nline4\nline5";
    const diff = `
<<<<<<< SEARCH
:start_line:2
:end_line:3
-------
lineX
lineY
=======
updatedLine2
updatedLine3
>>>>>>> REPLACE
`;

    mockReadFile.mockResolvedValue(fileContent);

    await expect(applyDiff({ path: filePath, diff })).rejects.toThrowError();
    expect(mockReadFile).toHaveBeenCalledWith(filePath, "utf-8");
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("should apply the diff with fuzzy match", async () => {
    const filePath = "test-file.txt";
    const fileContent = "line1\n  line2\n    line3\nline4\nline5";
    mockReadFile.mockResolvedValue(fileContent);
    const diff = `
<<<<<<< SEARCH
:start_line:2
:end_line:3
-------
line2
line3
=======
updatedLine2
updatedLine3
>>>>>>> REPLACE
`;

    const result = await applyDiff({ path: filePath, diff });

    expect(result).toEqual({ success: true });
    expect(mockReadFile).toHaveBeenCalledWith(filePath, "utf-8");
    expect(mockWriteFile).toHaveBeenCalledWith(
      filePath,
      "line1\nupdatedLine2\nupdatedLine3\nline4\nline5",
      "utf-8",
    );
  });
});
