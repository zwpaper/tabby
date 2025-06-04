/**
 * Fixes common issues in AI-generated text content
 */
const TrimStrings = ["\\\n", "\\", "```", "'''", '"""'];

export function fixCodeGenerationOutput(text: string): string {
  if (!text) {
    return text;
  }

  let processed = text;

  // Remove special characters and code block delimiters at start and end
  for (const str of TrimStrings) {
    if (processed.startsWith(str)) {
      processed = processed.substring(str.length);
    }
    if (processed.endsWith(str)) {
      processed = processed.substring(0, processed.length - str.length);
    }
  }

  return processed;
}
