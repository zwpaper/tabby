import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import type { TabInputText } from "vscode";

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
    } catch (error) {}

    current = parent;
    parent = vscode.Uri.file(path.dirname(current.fsPath));
  }

  if (token?.isCancellationRequested) {
    return;
  }

  let ignoreFiles: vscode.Uri[] = [];
  try {
    ignoreFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, "**/.gitignore"),
      undefined,
      undefined,
      token,
    );
  } catch (error) {}

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
      } catch (error) {}
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

function sortFiles(files: vscode.Uri[], query: string): vscode.Uri[] {
  const matchString = query.toLowerCase().split("*").filter(Boolean)[0];
  if (!matchString) {
    return files.toSorted((uriA, uriB) => {
      const basenameA = path.basename(uriA.fsPath).toLowerCase();
      const basenameB = path.basename(uriB.fsPath).toLowerCase();
      return basenameA.localeCompare(basenameB);
    });
  }

  const getScore = (basename: string) => {
    if (basename === matchString) {
      return 4;
    }
    if (basename.split(".").includes(matchString)) {
      return 3;
    }
    if (basename.startsWith(matchString)) {
      return 2;
    }
    if (basename.includes(matchString)) {
      return 1;
    }
    return 0;
  };
  return files.toSorted((uriA, uriB) => {
    const basenameA = path.basename(uriA.fsPath).toLowerCase();
    const basenameB = path.basename(uriB.fsPath).toLowerCase();
    const scoreA = getScore(basenameA);
    const scoreB = getScore(basenameB);
    if (scoreA > scoreB) {
      return -1;
    }
    if (scoreA < scoreB) {
      return 1;
    }
    if (basenameA === basenameB) {
      const dirnameA = path.dirname(uriA.fsPath).toLowerCase();
      const dirnameB = path.dirname(uriB.fsPath).toLowerCase();
      return dirnameA.localeCompare(dirnameB);
    }
    return basenameA.localeCompare(basenameB);
  });
}

function buildGlobPattern(query: string): vscode.GlobPattern {
  const caseInsensitivePattern = query
    .split("")
    .map((char) => {
      if (char.toLowerCase() !== char.toUpperCase()) {
        return `{${char.toLowerCase()},${char.toUpperCase()}}`;
      }
      return char.replace(/[?\[\]{}()!@]/g, "\\$&");
    })
    .join("");

  return `**/*${caseInsensitivePattern}{*,*/*}`;
}

/**
 * Lists files in the workspace matching the query, prioritizing opened editors, deduplicating, and respecting .gitignore and VSCode exclude settings.
 * @param query The search query string
 * @param limit Maximum number of files to return
 * @param token Optional cancellation token
 * @returns Array of { uri, isOpenedInEditor }
 */
export async function listFilesWithQuery(
  query: string,
  limit?: number,
  token?: vscode.CancellationToken,
): Promise<
  {
    uri: vscode.Uri;
    isOpenedInEditor: boolean;
  }[]
> {
  const maxResults = limit ?? 30;
  const queryString = query.trim().toLowerCase();

  const allEditorUris = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter((tab: vscode.Tab) => tab.input && (tab.input as TabInputText).uri)
    .map((tab: vscode.Tab) => (tab.input as TabInputText).uri as vscode.Uri);

  const editorUris = sortFiles(
    allEditorUris
      .filter(
        (uri: vscode.Uri, idx: number, arr: vscode.Uri[]) =>
          arr.findIndex((item) => item.fsPath === uri.fsPath) === idx,
      )
      .filter((uri: vscode.Uri) =>
        uri.fsPath.toLowerCase().includes(queryString),
      ),
    queryString,
  ).sort((uriA: vscode.Uri, uriB: vscode.Uri) => {
    const activeEditorUri = vscode.window.activeTextEditor?.document.uri;
    if (activeEditorUri) {
      if (uriA.fsPath === activeEditorUri.fsPath) return -1;
      if (uriB.fsPath === activeEditorUri.fsPath) return 1;
    }
    return 0;
  });

  const result = editorUris.map((uri: vscode.Uri) => {
    return {
      uri,
      isOpenedInEditor: true,
    };
  });
  if (result.length >= maxResults) {
    return result.slice(0, maxResults);
  }

  const globPattern = buildGlobPattern(queryString);

  try {
    const allExcludes = new Set<string>();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      for (const folder of workspaceFolders) {
        const patterns = gitIgnorePatternsMap.get(folder.uri.toString());
        if (patterns) {
          for (const pattern of patterns) {
            allExcludes.add(pattern);
          }
        }
      }
    }

    const editorExcludes = editorUris.map((uri: vscode.Uri) => {
      const relativePath = vscode.workspace.asRelativePath(uri);
      return `**/${relativePath}`;
    });

    const excludePatterns = [...allExcludes, ...editorExcludes];
    const sortedExcludes = excludePatterns
      .sort((a, b) => a.length - b.length)
      .slice(0, 1000);
    const excludePattern = `{${sortedExcludes.join(",")}}`;

    const foundFiles = await vscode.workspace.findFiles(
      globPattern,
      excludePattern,
      maxResults - editorUris.length,
      token,
    );

    const filteredFiles = foundFiles.filter(
      (file) => !file.fsPath.includes("node_modules"),
    );

    const searchResult = sortFiles(
      filteredFiles.filter(
        (uri: vscode.Uri, idx: number, arr: vscode.Uri[]) =>
          arr.findIndex((item) => item.fsPath === uri.fsPath) === idx &&
          !editorUris.some(
            (exisingUri: vscode.Uri) => exisingUri.fsPath === uri.fsPath,
          ),
      ),
      queryString,
    );

    result.push(
      ...searchResult.map((uri: vscode.Uri) => {
        return {
          uri,
          isOpenedInEditor: false,
        };
      }),
    );
  } catch (error) {}

  return result;
}

/**
 * Lists all files in the workspace using VSCode API with improved filtering.
 * @param maxItems Maximum number of files to return (default: 500)
 * @param useGitIgnore Whether to use .gitignore files for exclusion (default: true)
 * @returns Object containing files array and isTruncated flag
 */
export async function listAllFiles(
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
