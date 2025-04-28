import * as vscode from "vscode";

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
  const os = process.platform;
  const homedir = process.env.HOME || "";
  const shell = process.env.SHELL || "";
  const cwd =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

  return { cwd, shell, os, homedir };
}

/**
 * Collects custom rules from README.pochi.md and specified custom rule files.
 * Uses VSCode APIs instead of Node.js fs functions for better reliability.
 *
 * @param customRuleFiles Array of paths to custom rule files
 * @returns A string containing all collected rules, or undefined if no rules found
 */
export async function collectCustomRules(
  customRuleFiles: string[] = [],
): Promise<string> {
  let rules = "";

  // Try to read README.pochi.md from workspace root
  try {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
    ) {
      const readmePath = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders[0].uri,
        "README.pochi.md",
      );

      try {
        const readmeContent = await vscode.workspace.fs.readFile(readmePath);
        const rule = Buffer.from(readmeContent).toString("utf8");
        rules += `# Rules from ${readmePath.fsPath}\n${rule}\n`;
      } catch (error) {
        // File doesn't exist or can't be read, ignore
      }
    }
  } catch (error) {
    console.error("Error reading README.pochi.md:", error);
  }

  // Read custom rule files
  for (const rulePath of customRuleFiles) {
    try {
      // Convert string path to URI
      const ruleUri = vscode.Uri.file(rulePath);
      const ruleContent = await vscode.workspace.fs.readFile(ruleUri);
      const rule = Buffer.from(ruleContent).toString("utf8");
      rules += `# Rules from ${rulePath}\n${rule}\n`;
    } catch (error) {
      console.error(`Error reading custom rule file ${rulePath}:`, error);
    }
  }

  return rules;
}
