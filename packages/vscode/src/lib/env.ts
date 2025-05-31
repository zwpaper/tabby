import os from "node:os";
import path from "node:path";
import * as vscode from "vscode";
import { getWorkspaceFolder, readDirectoryFiles, readFileContent } from "./fs";

// Path constants - using arrays for consistency
const DefaultWorkspaceRulesFilePath = "README.pochi.md";
const WorkspaceRulesFilePath = [DefaultWorkspaceRulesFilePath];
const WorkflowsDirPath = [".pochi", "workflows"];

export function getCwd() {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
}

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
  const cwd = getCwd();

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
  { id: string; path: string; content: string }[]
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
      const fileName = file.split("/").pop()?.replace(/\.md$/, "") || file;

      return {
        id: fileName,
        path: file,
        content: content || "",
      };
    }),
  );
}

/**
 * Detects all cursor rule file paths in the workspace
 * @returns Array of cursor rule file paths found in the workspace
 */
export async function detectThirdPartyRules(): Promise<string[]> {
  const cursorRulePaths: string[] = [];

  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    return cursorRulePaths;
  }

  const workspaceFolder = vscode.workspace.workspaceFolders[0];

  try {
    // Check for legacy .cursorrules file in root
    const legacyRulesUri = vscode.Uri.joinPath(
      workspaceFolder.uri,
      ".cursorrules",
    );
    try {
      await vscode.workspace.fs.stat(legacyRulesUri);
      cursorRulePaths.push(vscode.workspace.asRelativePath(legacyRulesUri));
    } catch {
      // File doesn't exist, continue
    }

    // Find all .cursor/rules directories recursively
    const findCursorRulesDirectories = async (
      dirUri: vscode.Uri,
    ): Promise<void> => {
      try {
        const entries = await vscode.workspace.fs.readDirectory(dirUri);

        for (const [name, type] of entries) {
          const entryUri = vscode.Uri.joinPath(dirUri, name);

          if (type === vscode.FileType.Directory) {
            if (name === ".cursor") {
              // Check if this .cursor directory has a rules subdirectory
              const rulesUri = vscode.Uri.joinPath(entryUri, "rules");
              try {
                const rulesStat = await vscode.workspace.fs.stat(rulesUri);
                if (rulesStat.type === vscode.FileType.Directory) {
                  // Find all .mdc files in the rules directory
                  const findMdcFiles = async (
                    rulesDir: vscode.Uri,
                  ): Promise<void> => {
                    try {
                      const rulesEntries =
                        await vscode.workspace.fs.readDirectory(rulesDir);
                      for (const [ruleName, ruleType] of rulesEntries) {
                        const ruleUri = vscode.Uri.joinPath(rulesDir, ruleName);
                        if (
                          ruleType === vscode.FileType.File &&
                          ruleName.endsWith(".mdc")
                        ) {
                          cursorRulePaths.push(
                            vscode.workspace.asRelativePath(ruleUri),
                          );
                        } else if (ruleType === vscode.FileType.Directory) {
                          // Recursively check subdirectories for nested rules
                          await findMdcFiles(ruleUri);
                        }
                      }
                    } catch {
                      // Directory read failed, continue
                    }
                  };

                  await findMdcFiles(rulesUri);
                }
              } catch {
                // rules directory doesn't exist, continue
              }
            } else {
              // Recursively search other directories for nested .cursor/rules
              await findCursorRulesDirectories(entryUri);
            }
          }
        }
      } catch {
        // Directory read failed, continue
      }
    };

    await findCursorRulesDirectories(workspaceFolder.uri);
  } catch (error) {
    console.error("Error detecting cursor rule files:", error);
  }

  return cursorRulePaths;
}

/**
 * Copies cursor rules content to pochi rules file
 * @param cursorRulePaths Array of cursor rule file paths to copy from
 * @param targetFileName Name of the target pochi rules file (default: "cursor-rules.md")
 * @returns Promise that resolves when copying is complete
 */
export async function copyThirdPartyRules(
  cursorRulePaths: string[] = [],
  targetFileName = DefaultWorkspaceRulesFilePath,
): Promise<void> {
  const workspaceFolder = getWorkspaceFolder();

  // If no paths provided, auto-detect them
  let rulePaths = cursorRulePaths;
  if (rulePaths.length === 0) {
    rulePaths = await detectThirdPartyRules();
  }

  if (rulePaths.length === 0) {
    throw new Error("No cursor rule files found in workspace");
  }

  // Read existing workspace rules content
  const workspaceRulesUri = getWorkspaceRulesFileUri();
  const existingContent = await readFileContent(workspaceRulesUri.fsPath);

  let combinedContent = existingContent || "";

  // Add cursor rules section
  if (combinedContent.trim().length > 0) {
    combinedContent += "\n\n";
  }
  combinedContent += "# Imported Rules\n\n";
  combinedContent +=
    "The following rules were imported from external rule files.\n\n";

  // Process each cursor rule file
  for (const rulePath of rulePaths) {
    // Convert workspace-relative path to absolute path for reading
    // Use the workspaceFolder from the beginning of the function
    const absolutePath = vscode.Uri.joinPath(
      workspaceFolder.uri,
      rulePath,
    ).fsPath;
    const content = await readFileContent(absolutePath);
    if (content !== null && content.trim().length > 0) {
      const fileName = path.basename(rulePath);

      combinedContent += `## Rules from ${rulePath}\n\n`;

      // Handle .mdc files (MDC format) - extract content after metadata
      if (fileName.endsWith(".mdc")) {
        // MDC files may have metadata at the top, try to extract just the content
        const lines = content.split("\n");
        let contentStart = 0;
        let inMetadata = false;

        // Look for metadata section (usually starts with ---)
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line === "---") {
            if (!inMetadata) {
              inMetadata = true;
            } else {
              contentStart = i + 1;
              break;
            }
          }
        }

        const actualContent = lines.slice(contentStart).join("\n").trim();
        combinedContent += actualContent || content;
      } else {
        // For .cursorrules files, use content as-is
        combinedContent += content;
      }

      combinedContent += "\n\n";
    }
  }

  const targetUri = vscode.Uri.joinPath(workspaceFolder.uri, targetFileName);

  try {
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(
      targetUri,
      encoder.encode(combinedContent),
    );
  } catch (error) {
    throw new Error(`Failed to write pochi rules file: ${error}`);
  }
}
