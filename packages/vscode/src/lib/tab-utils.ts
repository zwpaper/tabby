import * as vscode from "vscode";
import { getLogger } from "./logger";

const logger = getLogger("tabUtils");
/**
 * Find tabs related to a preview by toolCallId
 */
export function findPreviewTabs(
  toolCallId: string,
  previewLabel?: string,
): vscode.Tab[] {
  const allTabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);
  logger.trace(`Found ${allTabs.length} total tabs across all groups`);

  return allTabs.filter((tab) => {
    // Check for diff tabs with our preview
    if (previewLabel && tab.label.includes(previewLabel) && tab.input) {
      logger.trace(`Found potential diff preview tab: ${tab.label}`);

      // For diff editors, check if either original or modified contains our toolCallId
      if (tab.input instanceof vscode.TabInputTextDiff) {
        const originalPath = tab.input.original.fsPath;
        const modifiedPath = tab.input.modified.fsPath;

        if (
          originalPath.includes(toolCallId) ||
          modifiedPath.includes(toolCallId)
        ) {
          logger.debug(`Found matching diff preview tab: ${tab.label}`);
          return true;
        }
      }
    }

    // Check for direct preview tabs
    if (tab.input && typeof tab.input === "object" && "uri" in tab.input) {
      const uri = (tab.input as { uri: vscode.Uri }).uri;
      if (uri.fsPath.includes(toolCallId)) {
        logger.debug(`Found direct preview tab: ${uri.fsPath}`);
        return true;
      }
    }

    return false;
  });
}

/**
 * Close tabs related to a preview
 */
export async function closePreviewTabs(tabs: vscode.Tab[]): Promise<void> {
  for (const tab of tabs) {
    logger.debug(`Closing preview tab: ${tab.label}`);
    try {
      await vscode.window.tabGroups.close(tab);
    } catch (closeError) {
      logger.warn(`Failed to close preview tab: ${closeError}`);
    }
  }
}
