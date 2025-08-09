import type { TextUIPart, UIMessage } from "@ai-sdk/ui-utils";
import { createCompactSummaryPrompt } from "./compact";
import {
  injectEnvironmentDetails,
  injectEnvironmentDetailsNext,
} from "./environment";
import { generateSystemPrompt } from "./system";

export const prompts = {
  system: generateSystemPrompt,
  injectEnvironmentDetails,
  injectEnvironmentDetailsNext,
  createSystemReminder,
  isSystemReminder,
  isCompactPart,
  isCompact,
  compact: createCompactSummaryPrompt,
  createCompactPart,
  extractSummaryFromPart,
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

function isCompactPart(part: UIMessage["parts"][number]) {
  return part.type === "text" && isCompact(part.text);
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

function extractSummaryFromPart(
  part: UIMessage["parts"][number],
): string | undefined {
  if (part.type !== "text" || !isCompactPart(part)) return undefined;

  const match = part.text.match(/^<compact>(.*)<\/compact>$/s);
  return match ? match[1] : undefined;
}
