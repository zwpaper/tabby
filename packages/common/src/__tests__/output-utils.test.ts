import { describe, it, expect } from "vitest";
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

  it('should remove backticks when present at both start and end', () => {
    expect(fixCodeGenerationOutput('```Hello```')).toBe('Hello');
  });

  it('should not remove backticks when only at start', () => {
    expect(fixCodeGenerationOutput('```Hello')).toBe('```Hello');
  });

  it('should not remove backticks when only at end', () => {
    expect(fixCodeGenerationOutput('Hello```')).toBe('Hello```');
  });

  it('should remove triple quotes when present at both start and end', () => {
    expect(fixCodeGenerationOutput('"""Hello"""')).toBe('Hello');
  });

  it('should remove single quotes when present at both start and end', () => {
    expect(fixCodeGenerationOutput("'''Hello'''")).toBe('Hello');
  });

  it('should handle markdown content with code blocks', () => {
    const markdownWithCodeBlock = `\`\`\`typescript
function hello() {
  console.log('Hello World');
}
\`\`\``;
    expect(fixCodeGenerationOutput(markdownWithCodeBlock)).toBe(`typescript
function hello() {
  console.log('Hello World');
}
`);
  });

  it('should not remove backticks from markdown with mixed content', () => {
    const mixedContent = `Here is some code:
\`\`\`javascript
console.log('test');
\`\`\`
And some more text.`;
    expect(fixCodeGenerationOutput(mixedContent)).toBe(mixedContent);
  });

  it('should not modify text without issues', () => {
    const input = 'Normal text without issues';
    expect(fixCodeGenerationOutput(input)).toBe(input);
  });
});
