import * as assert from "assert";
import { describe, it } from "mocha";
import { fixCodeGenerationOutput } from "../output-utils";

describe('fixCodeGenerationOutput', () => {
  it('should handle empty string', () => {
    assert.strictEqual(fixCodeGenerationOutput(''), '');
  });

  it('should remove leading backslash', () => {
    assert.strictEqual(fixCodeGenerationOutput('\\Hello'), 'Hello');
  });

  it('should remove leading backslash and new line', () => {
    assert.strictEqual(fixCodeGenerationOutput('\\\nHello'), 'Hello');
  });

  it('should remove leading backticks', () => {
    assert.strictEqual(fixCodeGenerationOutput('```Hello'), 'Hello');
  });

  it('should remove trailing backticks', () => {
    assert.strictEqual(fixCodeGenerationOutput('Hello```'), 'Hello');
  });


  it('should not modify text without issues', () => {
    const input = 'Normal text without issues';
    assert.strictEqual(fixCodeGenerationOutput(input), input);
  });
}); 