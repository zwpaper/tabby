import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeToFile } from "../write-to-file";

vi.mock("node:fs/promises");

describe("writeToFile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should write content to a file successfully", async () => {
    const mockWriteFile = vi.mocked(fs.writeFile);
    const mockMkdir = vi.mocked(fs.mkdir);

    const filePath = "test-file.txt";
    const fileContent = "This is a test content.";

    const result = await writeToFile({ path: filePath, content: fileContent });
    expect(result).toEqual({ success: true });

    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledWith(filePath, fileContent, "utf-8");
  });

  it("should throw an error when file writing fails", async () => {
    const mockError = new Error("File system error");
    vi.mocked(fs.writeFile).mockRejectedValueOnce(mockError);

    const filePath = "test-file.txt";
    const fileContent = "This is a test content.";

    await expect(
      writeToFile({ path: filePath, content: fileContent }),
    ).rejects.toThrow(`Failed to write to file: ${mockError}`);
  });
});
