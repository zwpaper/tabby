import os from "node:os";
import * as vscode from "vscode";
import { readDirectoryFiles, readFileContent } from "./fs";

// Path constants - using arrays for consistency
const WorkspaceRulesFilePath = ["README.pochi.md"];
const WorkflowsDirPath = [".pochirules", "workflows"];

/**
 * Gets system information such as current working directory, shell, OS, and home directory.
 * @returns An object containing system information such as cwd, shell, os, and homedir.
 */
export function getSystemInfo(): {
  cwd: string;
  shell: string;
  os: string;
  homedir: string;
} {
  const platform = process.platform;
  const homedir = os.homedir();
  const shell = process.env.SHELL || "";
  const cwd =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

  return { cwd, shell, os: platform, homedir };
}

/**
 * Gets a URI relative to workspace root, or fallback to current directory
 */
function getWorkspaceUri(...pathSegments: string[]): vscode.Uri {
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    return vscode.Uri.joinPath(
      vscode.workspace.workspaceFolders[0].uri,
      ...pathSegments,
    );
  }
  return vscode.Uri.file(pathSegments.join("/"));
}

export function getWorkspaceRulesFileUri() {
  return getWorkspaceUri(...WorkspaceRulesFilePath);
}

function getWorkflowsDirectoryUri() {
  return getWorkspaceUri(...WorkflowsDirPath);
}

/**
 * Collects custom rules from README.pochi.md and specified custom rule files.
 * Uses VSCode APIs instead of Node.js fs functions for better reliability.
 *
 * @param customRuleFiles Array of paths to custom rule files
 * @returns A string containing all collected rules, or empty string if no rules found
 */
export async function collectCustomRules(
  customRuleFiles: string[] = [],
): Promise<string> {
  let rules = "";

  // Add workspace rules file if workspace exists
  if (
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    customRuleFiles.push(getWorkspaceRulesFileUri().fsPath);
  }

  // Read all rule files
  for (const rulePath of customRuleFiles) {
    const content = await readFileContent(rulePath);
    if (content !== null) {
      const relativePath = vscode.workspace.asRelativePath(rulePath);
      rules += `# Rules from ${relativePath}\n${content}\n`;
    }
  }

  return rules;
}

/**
 * Collects all workflow files from .pochirules/workflows directory
 * @returns Array of workflow file paths
 */
export async function collectWorkflows(): Promise<
  { name: string; content: string }[]
> {
  const workflowsDir = getWorkflowsDirectoryUri();
  const isMarkdownFile = (name: string, type: vscode.FileType) =>
    type === vscode.FileType.File && name.toLowerCase().endsWith(".md");
  const files = await readDirectoryFiles(workflowsDir, isMarkdownFile);
  return Promise.all(
    files.map(async (file) => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const absolutePath = workspaceFolder
        ? vscode.Uri.joinPath(workspaceFolder.uri, file).fsPath
        : file;

      const content = await readFileContent(absolutePath);

      // e.g., ".pochirules/workflows/workflow1.md" -> "workflow1.md"
      const fileName = file.split("/").pop() || file;

      return {
        name: fileName,
        content: content || "",
      };
    }),
  );
}
