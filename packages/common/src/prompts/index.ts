import type { TextUIPart, UIMessage } from "@ai-sdk/ui-utils";
import type { Environment } from "@ragdoll/db";
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
  formatUserEdits,
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

function formatUserEdits(
  userEdits: NonNullable<Environment["userEdits"]>,
): string {
  if (userEdits.length === 0) {
    return "No changes since last checkpoint.";
  }

  const details = userEdits
    .map((edit) => {
      const { relative, before, after } = edit;

      if (!before && after) {
        const limitedContent = limitContent(after, 100);
        return `**${relative}** (new file)\n\`\`\`\n${limitedContent}\n\`\`\``;
      }
      if (before && !after) {
        // Deleted file
        return `**${relative}** (deleted)`;
      }
      // Modified file - show diff with 100 line limit
      const diffContent = createCompactDiff(before, after);
      return `**${relative}** (modified)\n\`\`\`diff\n${diffContent}\n\`\`\``;
    })
    .join("\n\n");

  return details;
}

function limitContent(content: string, maxLines: number): string {
  const lines = content.split("\n");
  if (lines.length <= maxLines) {
    return content;
  }
  return `${lines.slice(0, maxLines).join("\n")} \n... (truncated)`;
}

function createCompactDiff(before: string, after: string): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const diffLines: string[] = [];
  let totalLines = 0;
  const maxLines = 100;

  // Simple line-by-line comparison
  const maxLength = Math.max(beforeLines.length, afterLines.length);

  for (let i = 0; i < maxLength && totalLines < maxLines; i++) {
    const beforeLine = beforeLines[i] || "";
    const afterLine = afterLines[i] || "";

    if (beforeLine !== afterLine) {
      if (beforeLine && beforeLines[i] !== undefined) {
        diffLines.push(`-${beforeLine}`);
        totalLines++;
      }
      if (afterLine && afterLines[i] !== undefined) {
        diffLines.push(`+${afterLine}`);
        totalLines++;
      }
    }
  }

  if (totalLines >= maxLines) {
    diffLines.push(
      "... (truncated, exceeds 100 lines, if you want to make changes for this file, please do reread the file first and then make the changes)",
    );
  }

  return diffLines.join("\n");
}
