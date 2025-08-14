import type { TextUIPart } from "@ai-v5-sdk/ai";
import { createCompactSummaryPrompt } from "./compact";
import { injectEnvironmentDetails } from "./environment";
import { generateSystemPrompt } from "./system";

export const prompts = {
  system: generateSystemPrompt,
  injectEnvironmentDetails,
  createSystemReminder,
  isSystemReminder,
  isCompact,
  compact: createCompactSummaryPrompt,
  createCompactPart,
  extractSummary,
};

export { getReadEnvironmentResult } from "./environment";

function createSystemReminder(content: string) {
  return `<system-reminder>${content}</system-reminder>`;
}

function isSystemReminder(content: string) {
  return (
    (content.startsWith("<system-reminder>") &&
      content.endsWith("</system-reminder>")) ||
    // Handle legacy data, user-reminder / environment-details
    (content.startsWith("<user-reminder>") &&
      content.endsWith("</user-reminder>")) ||
    (content.startsWith("<environment-details>") &&
      content.endsWith("</environment-details>"))
  );
}

function isCompact(content: string) {
  return content.startsWith("<compact>") && content.endsWith("</compact>");
}

function createCompactPart(summary: string, messageCount: number): TextUIPart {
  const text = `<compact>
Previous conversation summary (${messageCount} messages):
${summary}
This section contains a summary of the conversation up to this point to save context. The full conversation history has been preserved but condensed for efficiency.
</compact>`;
  return { type: "text", text };
}

function extractSummary(text: string): string | undefined {
  const match = text.match(/^<compact>(.*)<\/compact>$/s);
  return match ? match[1] : undefined;
}
