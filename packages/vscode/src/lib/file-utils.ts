import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { getLogger } from "./logger";

const logger = getLogger("fileUtils");

/**
 * Create a temporary file with a unique name
 */
export function tempfile(options: { extension?: string } = {}): string {
  let { extension } = options;

  if (typeof extension === "string") {
    extension = extension.startsWith(".") ? extension : `.${extension}`;
  }

  const tempDirectory = fs.realpathSync(os.tmpdir());
  return path.join(tempDirectory, randomUUID() + (extension ?? ""));
}

/**
 * Check if a path is absolute
 */
export function isAbsolutePath(p: string): boolean {
  return p.startsWith("/") || p.startsWith("\\") || /^[A-Za-z]:/.test(p);
}

/**
 * Get the workspace folder or throw an error if none exists
 */
export function getWorkspaceFolder(): vscode.WorkspaceFolder {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    const error = new Error(
      "No workspace folder found. Please open a workspace.",
    );
    logger.error("No workspace folder found");
    throw error;
  }
  return workspaceFolders[0];
}

/**
 * Write content to a file
 */
export async function writeFile(
  uri: vscode.Uri,
  content: string,
): Promise<void> {
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
  logger.debug(`Successfully wrote content to file: ${uri.fsPath}`);
}

/**
 * Ensure a directory exists by creating it if needed
 */
export async function ensureDirectoryExists(dirUri: vscode.Uri): Promise<void> {
  logger.debug(`Creating directory if needed: ${dirUri.fsPath}`);
  await vscode.workspace.fs.createDirectory(dirUri);
}

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
