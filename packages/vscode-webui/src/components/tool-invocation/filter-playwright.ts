/**
 * Filter markdown code blocks from text content
 * Removes ```language\ncontent\n``` or ```\ncontent\n``` blocks
 */
function filterMarkdownFromText(text: string): string {
  if (typeof text !== "string") {
    return text;
  }
  const markdownBlockPattern = /```[\w]*\n[\s\S]*?\n```/g;
  let filtered = text.replace(markdownBlockPattern, "");
  filtered = filtered.replace(/\n\s*\n\s*\n/g, "\n\n");
  filtered = filtered.trim();
  return filtered;
}

/**
 * Unified safe markdown filter
 * Automatically detects input type and applies appropriate filtering
 * Returns original input if filtering fails
 */
// biome-ignore lint/suspicious/noExplicitAny: filtering any input type
function filterPlayrightMarkdown(input: any): any {
  try {
    if (typeof input === "string") {
      return filterMarkdownFromText(input);
    }
  } catch (error) {}
  return input;
}

export { filterPlayrightMarkdown };
