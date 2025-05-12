import * as assert from "assert";
import { describe, it } from "mocha";
import { parseDiffAndApply } from "@/lib/diff-utils";

describe("parseDiffAndApply", () => {
  it("should apply a simple diff correctly", async () => {
    const fileContent = `line 1
line 2
line 3
line 4
line 5`;
    const diff = `<<<<<<< SEARCH
line 2
line 3
=======
new line 2
new line 3
>>>>>>> REPLACE`;
    const startLine = 2;
    const endLine = 3;
    const expectedContent = `line 1
new line 2
new line 3
line 4
line 5`;

    const result = await parseDiffAndApply(
      diff,
      startLine,
      endLine,
      fileContent,
    );
    assert.strictEqual(result, expectedContent);
  });

  it("should apply a diff with leading/trailing whitespace correctly", async () => {
    const fileContent = `  line 1
    line 2
  line 3
line 4`;
    const diff = `<<<<<<< SEARCH
    line 2
  line 3
=======
    new line 2
  new line 3
>>>>>>> REPLACE`;
    const startLine = 2;
    const endLine = 3;
    const expectedContent = `  line 1
    new line 2
  new line 3
line 4`;

    const result = await parseDiffAndApply(
      diff,
      startLine,
      endLine,
      fileContent,
    );
    assert.strictEqual(result, expectedContent);
  });

  it("should handle diff at the beginning of the file", async () => {
    const fileContent = `line 1
line 2
line 3`;
    const diff = `<<<<<<< SEARCH
line 1
=======
new line 1
>>>>>>> REPLACE`;
    const startLine = 1;
    const endLine = 1;
    const expectedContent = `new line 1
line 2
line 3`;

    const result = await parseDiffAndApply(
      diff,
      startLine,
      endLine,
      fileContent,
    );
    assert.strictEqual(result, expectedContent);
  });

  it("should handle diff at the end of the file", async () => {
    const fileContent = `line 1
line 2
line 3`;
    const diff = `<<<<<<< SEARCH
line 3
=======
new line 3
>>>>>>> REPLACE`;
    const startLine = 3;
    const endLine = 3;
    const expectedContent = `line 1
line 2
new line 3`;

    const result = await parseDiffAndApply(
      diff,
      startLine,
      endLine,
      fileContent,
    );
    assert.strictEqual(result, expectedContent);
  });

  it("should handle empty replacement content", async () => {
    const fileContent = `line 1
line 2
line 3`;
    const diff = `<<<<<<< SEARCH
line 2
=======
>>>>>>> REPLACE`;
    const startLine = 2;
    const endLine = 2;
    const expectedContent = `line 1
line 3`;

    const result = await parseDiffAndApply(
      diff,
      startLine,
      endLine,
      fileContent,
    );
    assert.strictEqual(result, expectedContent);
  });

  it("should throw error for invalid diff format (missing separator)", async () => {
    const fileContent = `line 1
line 2`;
    const diff = `<<<<<<< SEARCH
line 1
>>>>>>> REPLACE`; // Missing =======
    const startLine = 1;
    const endLine = 1;

    await assert.rejects(
      parseDiffAndApply(diff, startLine, endLine, fileContent),
      (error: Error) => {
        assert.strictEqual(error.message, "Invalid diff format");
        return true;
      },
    );
  });

  it("should throw error for invalid diff format (missing SEARCH prefix)", async () => {
    const fileContent = `line 1
line 2`;
    const diff = `line 1
=======
new line 1
>>>>>>> REPLACE`; // Missing <<<<<<< SEARCH
    const startLine = 1;
    const endLine = 1;

    await assert.rejects(
      parseDiffAndApply(diff, startLine, endLine, fileContent),
      (error: Error) => {
        assert.ok(
          error.message.includes(
            "Diff format is incorrect. Expected '<<<<<<< SEARCH' prefix.",
          ),
        );
        return true;
      },
    );
  });

  it("should throw error for invalid diff format (missing REPLACE suffix)", async () => {
    const fileContent = `line 1
line 2`;
    const diff = `<<<<<<< SEARCH
line 1
=======
new line 1`; // Missing >>>>>>> REPLACE
    const startLine = 1;
    const endLine = 1;

    await assert.rejects(
      parseDiffAndApply(diff, startLine, endLine, fileContent),
      (error: Error) => {
        assert.ok(
          error.message.includes(
            "Diff format is incorrect. Expected '>>>>>>> REPLACE' suffix.",
          ),
        );
        return true;
      },
    );
  });

  it("should throw error when search content does not match", async () => {
    const fileContent = `line 1
line 2
line 3`;
    const diff = `<<<<<<< SEARCH
non-existent line
=======
new line
>>>>>>> REPLACE`;
    const startLine = 2;
    const endLine = 2;

    await assert.rejects(
      parseDiffAndApply(diff, startLine, endLine, fileContent),
      (error: Error) => {
        assert.ok(
          error.message.includes(
            "Search content does not match the original file content",
          ),
        );
        return true;
      },
    );
  });

  it("should handle search content outside the initial start/end line window", async () => {
    // Create a larger file content
    const fileContentLines = Array.from(
      { length: 50 },
      (_, i) => `line ${i + 1}`,
    );
    const fileContent = fileContentLines.join("\n");

    // Diff targets lines slightly outside the initial start/end range but within the expanded window
    const diff = `<<<<<<< SEARCH
line 18
line 19
line 20
line 21
line 22
=======
new content block
>>>>>>> REPLACE`;
    const startLine = 20; // Initial focus
    const endLine = 20;   // Initial focus

    const expectedLines = [...fileContentLines];
    expectedLines.splice(17, 5, "new content block"); // Replace lines 18-22 (0-based index 17, length 5)
    const expectedContent = expectedLines.join("\n");

    const result = await parseDiffAndApply(
      diff,
      startLine,
      endLine,
      fileContent,
    );
    assert.strictEqual(result, expectedContent);
  });

  it("should handle search content exactly at the edge of the expanded window", async () => {
    const fileContentLines = Array.from(
      { length: 30 },
      (_, i) => `line ${i + 1}`,
    );
    const fileContent = fileContentLines.join("\n");

    // Diff targets lines exactly at the start of the expanded window
    // WindowToExpandForSearch = 15
    // startLine = 20 -> 0-based index 19
    // searchWindowStartIndex = max(19 - 15, 0) = 4
    const diff = `<<<<<<< SEARCH
line 5
line 6
=======
new start lines
>>>>>>> REPLACE`;
    const startLine = 20;
    const endLine = 20;

    const expectedLines = [...fileContentLines];
    expectedLines.splice(4, 2, "new start lines"); // Replace lines 5-6 (0-based index 4, length 2)
    const expectedContent = expectedLines.join("\n");

    const result = await parseDiffAndApply(
      diff,
      startLine,
      endLine,
      fileContent,
    );
    assert.strictEqual(result, expectedContent);
  });
});

