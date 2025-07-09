import { LRUCache } from "lru-cache";
import hashObject from "object-hash";
import type {
  CompletionContext,
  CompletionExtraContexts,
  CompletionResultItem,
} from "./types";

export class CompletionCache extends LRUCache<string, CompletionResultItem[]> {
  constructor(maxSize = 100, ttl: number = 5 * 60 * 1000) {
    super({
      max: maxSize,
      ttl,
    });
  }
}

export function calculateCompletionContextHash(
  context: CompletionContext,
  extraContexts: CompletionExtraContexts,
): string {
  const hashData = {
    document: {
      uri: context.document.uri.toString(),
      prefix: context.prefix,
      suffix: context.suffix,
    },
    extraContexts: {
      git: extraContexts.git?.url || "",
      declarationsCount: extraContexts.declarations?.length || 0,
      recentFilesCount: extraContexts.recentlyChangedFiles?.length || 0,
      openFilesCount: extraContexts.recentlyOpenedFiles?.length || 0,
      editorTabSize: extraContexts.editorOptions?.tabSize || 4,
      editorInsertSpaces: extraContexts.editorOptions?.insertSpaces || true,
    },
  };

  return hashObject(hashData);
}
