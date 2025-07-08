import type {
  CacheKey,
  CompletionContext,
  CompletionExtraContexts,
  CompletionResultItem,
} from "./types";

export class CompletionCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly ttl: number;

  constructor(maxSize = 100, ttl: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttl;

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  generateKey(
    context: CompletionContext,
    extraContexts: CompletionExtraContexts,
  ): string {
    const key: CacheKey = {
      documentUri: context.document.uri.toString(),
      prefix: context.prefix,
      suffix: context.suffix,
      extraContextHash: this.hashExtraContexts(extraContexts),
    };

    return this.hashObject(key);
  }

  get(key: string): CompletionResultItem[] | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.items;
  }

  set(key: string, items: CompletionResultItem[]): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      items,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // Remove expired entries
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }
  }

  private hashExtraContexts(extraContexts: CompletionExtraContexts): string {
    const hashData = {
      git: extraContexts.git?.url || "",
      declarationsCount: extraContexts.declarations?.length || 0,
      recentFilesCount: extraContexts.recentlyChangedFiles?.length || 0,
      openFilesCount: extraContexts.recentlyOpenedFiles?.length || 0,
      editorTabSize: extraContexts.editorOptions?.tabSize || 4,
      editorInsertSpaces: extraContexts.editorOptions?.insertSpaces || true,
    };

    return this.hashObject(hashData);
  }

  private hashObject(obj: object): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  // Statistics for debugging
  getStats(): CacheStats {
    const now = Date.now();
    let expiredCount = 0;

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > this.ttl) {
        expiredCount++;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      expiredCount,
      hitRate: 0, // Would need to track hits/misses to calculate
    };
  }
}

interface CacheEntry {
  items: CompletionResultItem[];
  timestamp: number;
}

interface CacheStats {
  size: number;
  maxSize: number;
  expiredCount: number;
  hitRate: number;
}
