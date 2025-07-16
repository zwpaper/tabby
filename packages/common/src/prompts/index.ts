import type { Environment } from "@ragdoll/db";
import { injectEnvironmentDetails } from "./environment";
import { generateSystemPrompt } from "./system";

export const prompts = {
  system: generateSystemPrompt,
  injectEnvironmentDetails,
  createSystemReminder,
  isSystemReminder,
  formatUserEdits,
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
