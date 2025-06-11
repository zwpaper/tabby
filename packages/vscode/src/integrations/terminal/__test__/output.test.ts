import * as assert from "assert";
import { describe, it, beforeEach } from "mocha";
import { OutputTruncator } from "../output";
import { MaxTerminalOutputSize } from "@ragdoll/common/node";

describe("OutputTruncator", () => {
  let truncator: OutputTruncator;

  beforeEach(() => {
    truncator = new OutputTruncator();
  });

  it("should truncate lines exceeding the maximum size", () => {
    // Create lines that will exceed the limit (MaxTerminalOutputSize is 30,000)
    const lines = [
      "a".repeat(8000), // 8000 bytes
      "b".repeat(8000), // 8000 bytes  
      "c".repeat(8000), // 8000 bytes
      "d".repeat(8000), // 8000 bytes
    ];
    // Total: 32000 bytes + 6 bytes for separators = 32006 bytes (exceeds 30000)

    const result = truncator.truncateLines(lines);

    // Should remove lines from the beginning until under limit
    assert.strictEqual(result.isTruncated, true);
    assert.ok(result.lines.length < lines.length);
    
    // Verify the content size is under the limit
    const joinedContent = result.lines.join("\r\n");
    const contentBytes = Buffer.byteLength(joinedContent, "utf8");
    assert.ok(contentBytes <= MaxTerminalOutputSize);
  });

  it("should not truncate when content is under limit", () => {
    const lines = [
      "short line 1",
      "short line 2", 
      "short line 3",
    ];

    const result = truncator.truncateLines(lines);

    assert.strictEqual(result.isTruncated, false);
    assert.deepStrictEqual(result.lines, lines);
  });

  it("should handle empty lines array", () => {
    const result = truncator.truncateLines([]);

    assert.strictEqual(result.isTruncated, false);
    assert.deepStrictEqual(result.lines, []);
  });

  it("should handle single line that exceeds limit", () => {
    const lines = ["x".repeat(35000)]; // Single line exceeding limit (35000 > 30000)

    const result = truncator.truncateLines(lines);

    // Should remove all lines if even one line exceeds the limit
    assert.strictEqual(result.isTruncated, true);
    assert.deepStrictEqual(result.lines, []);
  });

  it("should preserve the most recent lines when truncating", () => {
    const lines = [
      "oldest line",
      "middle line", 
      "newest line",
    ];
    
    // Force truncation by making lines large
    const largeLines = lines.map(line => line + "x".repeat(10000));

    const result = truncator.truncateLines(largeLines);

    assert.strictEqual(result.isTruncated, true);
    // Should keep the newest (last) lines
    assert.ok(result.lines[result.lines.length - 1].includes("newest line"));
  });
});













