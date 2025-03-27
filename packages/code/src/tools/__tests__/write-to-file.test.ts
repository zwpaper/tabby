import fs from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { writeToFile } from "../write-to-file";

vi.mock("node:fs/promises");

describe("writeToFile", () => {
  it("should write content to a file successfully", async () => {
    const mockWriteFile = vi.mocked(fs.writeFile);

    const filePath = "test-file.txt";
    const fileContent = "This is a test content.";

    await writeToFile({ path: filePath, content: fileContent });

    expect(mockWriteFile).toHaveBeenCalledWith(filePath, fileContent, "utf-8");
  });

  it("should handle errors when writing to a file", async () => {
    const mockWriteFile = vi.mocked(fs.writeFile);
    const filePath = "/nonexistent/test-file.txt";
    const fileContent = "This is a test content.";
    const error = new Error("EACCES: permission denied");

    mockWriteFile.mockRejectedValue(error);

    await expect(writeToFile({ path: filePath, content: fileContent })).rejects.toThrow(new Error("Failed to write to file: Error: EACCES: permission denied"));
  });
});
