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

  it("should throw an error if writing to the file fails", async () => {
    const mockWriteFile = vi.mocked(fs.writeFile);
    mockWriteFile.mockRejectedValue(new Error("Write failed"));

    const filePath = "test-file.txt";
    const fileContent = "This is a test content.";

    await expect(
      writeToFile({ path: filePath, content: fileContent }),
    ).rejects.toThrow("Write failed");

    expect(mockWriteFile).toHaveBeenCalledWith(filePath, fileContent, "utf-8");
  });
});
