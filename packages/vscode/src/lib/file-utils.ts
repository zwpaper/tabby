import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

const gitIgnorePatternsMap = new Map<string, Set<string>>();

/**
 * Converts a gitignore line to exclude patterns
 *
 * @param item The gitignore line
 * @param prefix Optional prefix for the pattern (for subdirectory gitignore files)
 * @returns Array of exclude patterns
 */
function gitIgnoreItemToExcludePattern(
  item: string,
  prefix?: string,
): string[] {
  let pattern = item.trim();
  if (pattern.length === 0) {
    return [];
  }
  if (
    pattern.indexOf("/") === -1 ||
    pattern.indexOf("/") === pattern.length - 1
  ) {
    if (!pattern.startsWith("**/")) {
      pattern = `**/${pattern}`;
    }
  } else if (pattern.startsWith("/")) {
    pattern = pattern.slice(1);
  }
  return [
    path.join(prefix ?? "", pattern),
    path.join(prefix ?? "", pattern, "/**"),
  ];
}

/**
 * Updates gitignore patterns for a workspace folder
 *
 * @param workspaceFolder The workspace folder
 * @param token Optional cancellation token
 */
async function updateGitIgnorePatterns(
  workspaceFolder: vscode.WorkspaceFolder,
  token?: vscode.CancellationToken,
): Promise<void> {
  const patterns = new Set<string>();

  // Read parent gitignore files
  let current = workspaceFolder.uri;
  let parent = vscode.Uri.file(path.dirname(current.fsPath));
  while (parent.fsPath !== current.fsPath) {
    if (token?.isCancellationRequested) {
      return;
    }

    const gitignore = vscode.Uri.joinPath(parent, ".gitignore");
    try {
      const content = new TextDecoder().decode(
        await vscode.workspace.fs.readFile(gitignore),
      );
      for (const line of content.split(/\r?\n/)) {
        if (!line.trim().startsWith("#")) {
          for (const pattern of gitIgnoreItemToExcludePattern(line)) {
            patterns.add(pattern);
          }
        }
      }
    } catch (error) {
      // ignore
    }

    current = parent;
    parent = vscode.Uri.file(path.dirname(current.fsPath));
  }

  if (token?.isCancellationRequested) {
    return;
  }

  // Read subdirectories gitignore files
  let ignoreFiles: vscode.Uri[] = [];
  try {
    ignoreFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, "**/.gitignore"),
      undefined,
      undefined,
      token,
    );
  } catch (error) {
    // ignore
  }

  await Promise.all(
    ignoreFiles.map(async (ignoreFile) => {
      if (token?.isCancellationRequested) {
        return;
      }
      const prefix = path.relative(
        workspaceFolder.uri.fsPath,
        path.dirname(ignoreFile.fsPath),
      );
      try {
        const content = new TextDecoder().decode(
          await vscode.workspace.fs.readFile(ignoreFile),
        );
        for (const line of content.split(/\r?\n/)) {
          if (!line.trim().startsWith("#")) {
            for (const pattern of gitIgnoreItemToExcludePattern(line, prefix)) {
              patterns.add(pattern);
            }
          }
        }
      } catch (error) {
        // ignore
      }
    }),
  );

  gitIgnorePatternsMap.set(workspaceFolder.uri.toString(), patterns);
}

/**
 * Updates gitignore patterns for all workspace folders
 *
 * @param token Optional cancellation token
 */
export async function updateGitIgnorePatternsMap(
  token?: vscode.CancellationToken,
): Promise<void> {
  await Promise.all(
    vscode.workspace.workspaceFolders?.map(async (workspaceFolder) => {
      await updateGitIgnorePatterns(workspaceFolder, token);
    }) ?? [],
  );
}

/**
 * Initializes file watchers for gitignore files
 *
 * @param context The extension context
 */
export async function init(context: vscode.ExtensionContext): Promise<void> {
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      await updateGitIgnorePatternsMap();
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      const uri = event.document.uri;
      if (path.basename(uri.fsPath) === ".gitignore") {
        await updateGitIgnorePatternsMap();
      }
    }),
  );

  await updateGitIgnorePatternsMap();
}

/**
 * Creates a glob pattern for excluding directories
 *
 * @param dirs Directories to exclude
 * @returns A glob pattern string for use with findFiles
 */
function createExcludePattern(dirs: string[]): string {
  const patterns = dirs.flatMap((dir) => [`**/${dir}/**`, `**/${dir}`]);
  return `{${patterns.join(",")}}`;
}

/**
 * Lists files in the workspace using VSCode API with improved filtering
 *
 * @param maxItems Maximum number of files to return (default: 500)
 * @param ignoreDirs Optional directories to ignore (default: empty array)
 * @param useGitIgnore Whether to use .gitignore files for exclusion (default: true)
 * @returns Object containing files array and isTruncated flag
 */
export async function listFiles(
  maxItems = 500,
  useGitIgnore = true,
): Promise<{ files: string[]; isTruncated: boolean }> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const files: string[] = [];
  let isTruncated = false;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return { files, isTruncated };
  }

  try {
    for (const folder of workspaceFolders) {
      const allExcludes = new Set<string>();

      if (useGitIgnore) {
        const gitIgnorePatterns = gitIgnorePatternsMap.get(
          folder.uri.toString(),
        );
        if (gitIgnorePatterns) {
          for (const pattern of gitIgnorePatterns) {
            allExcludes.add(pattern);
          }
        }
      }

      const excludePattern = createExcludePattern([...allExcludes]);
      const fileUris = await vscode.workspace.findFiles(
        new vscode.RelativePattern(folder, "**/*"),
        excludePattern,
        maxItems - files.length,
      );

      for (const uri of fileUris) {
        const relativePath = vscode.workspace.asRelativePath(uri);
        files.push(relativePath);

        if (files.length >= maxItems) {
          isTruncated = true;
          break;
        }
      }

      if (files.length >= maxItems) {
        isTruncated = true;
        break;
      }
    }
  } catch (error) {
    // TODO: log later
    return { files: [], isTruncated: false };
  }

  return { files, isTruncated };
}

export function tempfile(options: { extension?: string } = {}): string {
  let { extension } = options;

  if (typeof extension === "string") {
    extension = extension.startsWith(".") ? extension : `.${extension}`;
  }

  const tempDirectory = fs.realpathSync(os.tmpdir());
  return path.join(tempDirectory, randomUUID() + (extension ?? ""));
}
