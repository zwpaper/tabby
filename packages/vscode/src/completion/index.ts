// Re-export completion components for use in other modules
export { CompletionConfiguration as RagdollCompletionConfig } from "./configuration";
export { InlineCompletionProvider as RagdollInlineCompletionProvider } from "./inline-completion-provider";
export { CompletionStatusBarManager } from "./status-bar-manager";
export * from "./types";

// Export default configuration for easy access
export { DefaultCompletionConfig as DEFAULT_COMPLETION_CONFIG } from "./types";
