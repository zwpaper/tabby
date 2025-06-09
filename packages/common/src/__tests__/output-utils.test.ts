import { describe, it, expect } from "bun:test";
import { fixCodeGenerationOutput } from "../output-utils";

describe('fixCodeGenerationOutput', () => {
  it('should handle empty string', () => {
    expect(fixCodeGenerationOutput('')).toBe('');
  });

  it('should remove leading backslash', () => {
    expect(fixCodeGenerationOutput('\\Hello')).toBe('Hello');
  });

  it('should remove leading backslash and new line', () => {
    expect(fixCodeGenerationOutput('\\\nHello')).toBe('Hello');
  });

  it('should remove leading backticks', () => {
    expect(fixCodeGenerationOutput('```Hello')).toBe('Hello');
  });

  it('should remove trailing backticks', () => {
    expect(fixCodeGenerationOutput('Hello```')).toBe('Hello');
  });

  it('should not modify text without issues', () => {
    const input = 'Normal text without issues';
    expect(fixCodeGenerationOutput(input)).toBe(input);
  });
});