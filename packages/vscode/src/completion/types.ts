import type { GitPlatform } from "@ragdoll/common/git-utils";
import type { Position, Range, TextDocument } from "vscode";

// Basic completion types (matching backend API)
export interface CompletionRequest {
  language?: string;
  segments: {
    prefix: string;
    suffix?: string;
    filepath?: string;
    git_url?: string;
    declarations?: DeclarationSnippet[];
    relevant_snippets_from_changed_files?: CodeSnippet[];
    relevant_snippets_from_recently_opened_files?: CodeSnippet[];
    clipboard?: string;
  };
  temperature?: number;
  mode?: "standard" | "next_edit_suggestion";
}

export interface CompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    text: string;
  }>;
}

export interface DeclarationSnippet {
  filepath: string;
  body: string;
}

export interface CodeSnippet {
  filepath: string;
  body: string;
  score?: number;
}

// Internal completion context types
export interface CompletionContext {
  readonly document: TextDocument;
  readonly position: Position;
  readonly prefix: string;
  readonly suffix: string;
  readonly isLineEnd: boolean;
  readonly lineEndReplaceLength: number;
  readonly prefixLines: string[];
  readonly suffixLines: string[];
  readonly currentLinePrefix: string;
  readonly currentLineSuffix: string;
}

export interface CompletionExtraContexts {
  workspace?: WorkspaceContext;
  git?: GitContext;
  declarations?: DeclarationSnippet[];
  recentlyChangedFiles?: CodeSnippet[];
  recentlyOpenedFiles?: CodeSnippet[];
  editorOptions?: EditorOptionsContext;
}

export interface WorkspaceContext {
  name?: string;
  folders: string[];
}

export interface GitContext {
  url?: string;
  branch?: string;
  rootPath?: string;
  // Enhanced git information from git-utils
  platform?: GitPlatform;
  owner?: string;
  repo?: string;
  shorthand?: string;
  webUrl?: string;
}

export interface EditorOptionsContext {
  tabSize: number;
  insertSpaces: boolean;
  indentationDetected?: string;
}

// Post-processing types
export interface CompletionResultItem {
  text: string;
  range?: Range;
}

export interface PostProcessFilter {
  process(
    item: CompletionResultItem,
    context: CompletionContext,
  ): CompletionResultItem;
}

// Cache types
export interface CacheKey {
  documentUri: string;
  prefix: string;
  suffix: string;
  extraContextHash: string;
}

// Displayed completion tracking
export interface DisplayedCompletion {
  id: string;
  completions: CompletionResponse;
  index: number;
  displayedAt: number;
}

// Debouncer types
export interface DebouncingContext {
  triggerCharacter: string;
  isLineEnd?: boolean;
  isDocumentEnd?: boolean;
  manually?: boolean;
  estimatedResponseTime?: number;
}

// Configuration types
export interface CompletionConfig {
  enabled: boolean;
  triggerMode: "automatic" | "manual";
  disabledLanguages: string[];
  maxPrefixLines: number;
  maxSuffixLines: number;
  debounceDelay: number;
  temperature: number;
  cacheSize: number;
  cacheTTL: number;
}

// Default completion configuration
export const DefaultCompletionConfig: CompletionConfig = {
  enabled: true,
  triggerMode: "automatic",
  disabledLanguages: ["plaintext"],
  maxPrefixLines: 20,
  maxSuffixLines: 20,
  debounceDelay: 300,
  temperature: 0.1,
  cacheSize: 100,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
};

// Error types
export class CompletionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "CompletionError";
  }
}

// Event types
export type CompletionEvent =
  | { type: "show"; completion: DisplayedCompletion }
  | { type: "accept"; completion: DisplayedCompletion; index?: number }
  | { type: "dismiss"; completion: DisplayedCompletion }
  | { type: "accept_word"; completion: DisplayedCompletion }
  | { type: "accept_line"; completion: DisplayedCompletion };
