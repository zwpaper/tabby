import type { GitPlatform } from "@ragdoll/common/git-utils";
import type { Position, Range, TextDocument } from "vscode";

import type { ApiClient } from "@/lib/auth-client";
import type { InferRequestType, InferResponseType } from "hono";

type CompletionApi = ApiClient["api"]["code"]["completion"]["$post"];

// Basic completion types (matching backend API)
export type CompletionRequest = InferRequestType<CompletionApi>["json"];
export type CompletionResponse = InferResponseType<CompletionApi>;

export type DeclarationSnippet = NonNullable<
  CompletionRequest["segments"]["declarations"]
>[number];
export type CodeSnippet = NonNullable<
  CompletionRequest["segments"]["relevantSnippetsFromChangedFiles"]
>[number];

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
  range: Range;
}

export interface PostProcessFilter {
  process(
    item: CompletionResultItem,
    context: CompletionContext,
  ): CompletionResultItem;
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
