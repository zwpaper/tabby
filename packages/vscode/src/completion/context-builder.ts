/**
 * Context Builder for Code Completion
 *
 * This module provides context gathering for code completion, inspired by Tabby's implementation.
 *
 * Current Implementation Status (compared to Tabby's context providers):
 *
 * ✅ Implemented:
 * - declarationSnippets.ts → getDeclarations(): Uses VSCode's symbol provider to extract declarations
 * - git/index.ts → getGitContext(): Provides Git repository information using GitStatusReader
 * - workspace.ts → getWorkspaceContext(): Gets workspace folders and names
 * - editorOptions.ts → getEditorOptions(): Detects tab size, spaces, and indentation
 * - editorVisibleRanges.ts → getRecentlyOpenedFiles(): Gets snippets from recently opened tabs
 *
 * ❌ Not Implemented:
 * - recentlyChangedCodeSearch.ts → getRecentlyChangedFiles():
 *   - Missing: Real-time indexing, search engine (Orama), debouncing, chunking
 *   - Currently returns undefined
 * - documentContexts.ts: Not needed as VSCode provides document access directly
 * - git/gitCommand.ts: We use GitStatusReader instead
 *
 * Key Differences from Tabby:
 * 1. No search engine - we don't index code for semantic search
 * 2. No real-time change tracking - we don't listen to document changes
 * 3. No caching layer - relies on VSCode's internal caching
 */

import { getLogger } from "@ragdoll/common";
import { parseGitOriginUrl } from "@ragdoll/common/git-utils";
import { GitStatusReader } from "@ragdoll/common/node";
import * as vscode from "vscode";
import type {
  CodeSnippet,
  CompletionContext,
  CompletionExtraContexts,
  DeclarationSnippet,
  EditorOptionsContext,
  GitContext,
  WorkspaceContext,
} from "./types";

const logger = getLogger("ContextBuilder");
export class ContextBuilder {
  buildCompletionContext(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
  ): CompletionContext {
    const text = document.getText();
    const offset = document.offsetAt(position);

    const prefix = text.slice(0, offset);
    const suffix = text.slice(offset);

    // Check if cursor is at line end (only whitespace after cursor on current line)
    const currentLineSuffix = suffix.split("\n")[0] || "";
    const isLineEnd = /^\s*$/.test(currentLineSuffix);

    // Calculate how many characters should be replaced at line end
    const lineEndReplaceLength =
      this.calculateLineEndReplaceLength(currentLineSuffix);

    const prefixLines = prefix.split("\n");
    const suffixLines = suffix.split("\n");

    return {
      document,
      position,
      prefix,
      suffix,
      isLineEnd,
      lineEndReplaceLength,
      prefixLines,
      suffixLines,
      currentLinePrefix: prefixLines[prefixLines.length - 1] || "",
      currentLineSuffix,
    };
  }

  async fetchExtraContext(
    context: CompletionContext,
    _isManualTrigger: boolean, // TODO(sma1lboy): handle manual trigger
  ): Promise<CompletionExtraContexts> {
    // Note: timeout logic removed for simplicity

    // Fetch all context types in parallel
    const promises = [
      this.getWorkspaceContext(context),
      this.getGitContext(context),
      this.getDeclarations(context),
      this.getRecentlyChangedFiles(context),
      this.getRecentlyOpenedFiles(context),
      this.getEditorOptions(context),
    ] as const;

    const results = await Promise.allSettled(promises);

    return {
      workspace:
        results[0].status === "fulfilled"
          ? (results[0].value as WorkspaceContext | undefined)
          : undefined,
      git:
        results[1].status === "fulfilled"
          ? (results[1].value as GitContext | undefined)
          : undefined,
      declarations:
        results[2].status === "fulfilled"
          ? (results[2].value as DeclarationSnippet[] | undefined)
          : undefined,
      recentlyChangedFiles:
        results[3].status === "fulfilled"
          ? (results[3].value as CodeSnippet[] | undefined)
          : undefined,
      recentlyOpenedFiles:
        results[4].status === "fulfilled"
          ? (results[4].value as CodeSnippet[] | undefined)
          : undefined,
      editorOptions:
        results[5].status === "fulfilled"
          ? (results[5].value as EditorOptionsContext | undefined)
          : undefined,
    };
  }

  private calculateLineEndReplaceLength(suffix: string): number {
    // Count whitespace characters at the beginning of suffix that should be replaced
    const match = suffix.match(/^\s*/);
    return match ? match[0].length : 0;
  }

  private async getWorkspaceContext(
    _context: CompletionContext,
  ): Promise<WorkspaceContext | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return undefined;
    }

    return {
      name: vscode.workspace.name,
      folders: workspaceFolders.map((folder) => folder.uri.fsPath),
    };
  }

  private async getGitContext(
    context: CompletionContext,
  ): Promise<GitContext | undefined> {
    // Get workspace folder for current document
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      context.document.uri,
    );
    if (!workspaceFolder) {
      return undefined;
    }

    // Use GitStatusReader to get comprehensive git information
    const gitStatusReader = new GitStatusReader({
      cwd: workspaceFolder.uri.fsPath,
    });

    const gitStatus = await gitStatusReader.readGitStatus();
    if (!gitStatus) {
      return undefined;
    }

    // Parse the git URL using the shared git-utils
    const gitInfo = gitStatus.origin
      ? parseGitOriginUrl(gitStatus.origin)
      : null;

    // Build enhanced GitContext with parsed information
    const gitContext: GitContext = {
      url: gitStatus.origin,
      branch: gitStatus.currentBranch,
      rootPath: workspaceFolder.uri.fsPath,
    };

    // Add parsed git information if available
    if (gitInfo) {
      gitContext.platform = gitInfo.platform;
      gitContext.owner = gitInfo.owner;
      gitContext.repo = gitInfo.repo;
      gitContext.shorthand = gitInfo.shorthand;
      gitContext.webUrl = gitInfo.webUrl;
    }

    return gitContext;
  }

  private async getDeclarations(
    context: CompletionContext,
  ): Promise<DeclarationSnippet[] | undefined> {
    try {
      // Use LSP to get symbol information
      const symbols = await vscode.commands.executeCommand<
        vscode.DocumentSymbol[]
      >("vscode.executeDocumentSymbolProvider", context.document.uri);

      if (!symbols || symbols.length === 0) {
        return undefined;
      }

      const declarations: DeclarationSnippet[] = [];

      // Extract function and class declarations
      for (const symbol of symbols) {
        if (this.isRelevantSymbol(symbol)) {
          const range = symbol.selectionRange || symbol.range;
          const text = context.document.getText(range);

          declarations.push({
            filepath: vscode.workspace.asRelativePath(context.document.uri),
            body: text,
          });
        }

        // Also check nested symbols
        if (symbol.children) {
          for (const child of symbol.children) {
            if (this.isRelevantSymbol(child)) {
              const range = child.selectionRange || child.range;
              const text = context.document.getText(range);

              declarations.push({
                filepath: vscode.workspace.asRelativePath(context.document.uri),
                body: text,
              });
            }
          }
        }
      }

      return declarations.length > 0 ? declarations.slice(0, 5) : undefined; // Limit to top 5
    } catch (error) {
      logger.debug("Failed to get declarations:", error);
      return undefined;
    }
  }

  private isRelevantSymbol(symbol: vscode.DocumentSymbol): boolean {
    // Include functions, methods, classes, interfaces
    return [
      vscode.SymbolKind.Function,
      vscode.SymbolKind.Method,
      vscode.SymbolKind.Class,
      vscode.SymbolKind.Interface,
      vscode.SymbolKind.Constructor,
    ].includes(symbol.kind);
  }

  private async getRecentlyChangedFiles(
    context: CompletionContext,
  ): Promise<CodeSnippet[] | undefined> {
    try {
      // Get recently modified files from git if available
      const gitContext = await this.getGitContext(context);
      if (!gitContext?.rootPath) {
        return undefined;
      }

      // TODO(sma1lboy): Implement recently changed files context
      //
      // Tabby's implementation includes:
      // 1. Real-time indexing of file changes using TextDocument change events
      // 2. Debouncing mechanism to avoid excessive indexing
      // 3. Code search engine (Orama) for fast semantic search
      // 4. Chunking strategy (configurable chunk size and overlap)
      // 5. Symbol extraction and scoring based on relevance
      //
      // Our current implementation status:
      // - [ ] Real-time change tracking (Tabby uses onDidChangeContent)
      // - [ ] Search engine integration (Tabby uses Orama)
      // - [ ] Intelligent chunking of code files
      // - [ ] Semantic search based on symbols
      // - [ ] Configurable indexing parameters
      //
      // For now, returning undefined as this requires:
      // 1. Setting up a search engine (like Orama)
      // 2. Implementing file change listeners
      // 3. Building an indexing system

      return undefined;
    } catch (error) {
      logger.debug("Failed to get recently changed files:", error);
      return undefined;
    }
  }

  private async getRecentlyOpenedFiles(
    context: CompletionContext,
  ): Promise<CodeSnippet[] | undefined> {
    try {
      // Get recently opened tabs
      const tabGroups = vscode.window.tabGroups.all;
      const recentFiles: CodeSnippet[] = [];

      for (const group of tabGroups) {
        for (const tab of group.tabs) {
          if (tab.input instanceof vscode.TabInputText) {
            const uri = tab.input.uri;

            // Skip current file and non-code files
            if (
              uri.toString() === context.document.uri.toString() ||
              !this.isCodeFile(uri.fsPath)
            ) {
              continue;
            }

            try {
              const doc = await vscode.workspace.openTextDocument(uri);
              const text = doc.getText();

              // Extract a relevant snippet (first 500 characters for now)
              const snippet = text.slice(0, 500);

              recentFiles.push({
                filepath: vscode.workspace.asRelativePath(uri),
                body: snippet,
                score: 0.5, // Simple fixed score for now
              });
            } catch {
              // continue
            }
          }
        }
      }

      return recentFiles.length > 0 ? recentFiles.slice(0, 3) : undefined; // Limit to top 3
    } catch (error) {
      logger.debug("Failed to get recently opened files:", error);
      return undefined;
    }
  }

  private isCodeFile(filePath: string): boolean {
    const codeExtensions = [
      ".ts",
      ".js",
      ".tsx",
      ".jsx",
      ".py",
      ".java",
      ".c",
      ".cpp",
      ".h",
      ".hpp",
      ".cs",
      ".go",
      ".rs",
      ".php",
      ".rb",
      ".swift",
      ".kt",
      ".scala",
      ".sh",
      ".ps1",
      ".sql",
      ".html",
      ".css",
      ".scss",
      ".less",
      ".vue",
      ".svelte",
    ];

    return codeExtensions.some((ext) => filePath.endsWith(ext));
  }

  private async getEditorOptions(
    context: CompletionContext,
  ): Promise<EditorOptionsContext | undefined> {
    try {
      const editor = vscode.window.visibleTextEditors.find(
        (e) => e.document.uri.toString() === context.document.uri.toString(),
      );

      if (!editor) {
        return undefined;
      }

      return {
        tabSize: editor.options.tabSize as number,
        insertSpaces: editor.options.insertSpaces as boolean,
        indentationDetected: this.detectIndentation(context.prefixLines),
      };
    } catch (error) {
      logger.debug("Failed to get editor options:", error);
      return undefined;
    }
  }

  private detectIndentation(lines: string[]): string | undefined {
    const matches = { "\t": 0, "  ": 0, "    ": 0 };

    for (const line of lines) {
      if (line.match(/^\t/)) {
        matches["\t"]++;
      } else {
        const spaces = line.match(/^ */)?.[0].length ?? 0;
        if (spaces > 0) {
          if (spaces % 4 === 0) matches["    "]++;
          if (spaces % 2 === 0) matches["  "]++;
        }
      }
    }

    // Priority: tabs > 2-spaces > 4-spaces
    if (matches["\t"] > 0) return "\t";
    if (matches["  "] > matches["    "]) return "  ";
    if (matches["    "] > 0) return "    ";
    return undefined;
  }
}
