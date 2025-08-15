import { describe, expect, test } from "vitest";
import { GitStatusReader } from "../git-status";
import type { GitStatusReaderOptions } from "../git-status";

describe("GitStatusReader", () => {
  let gitStatusReader: GitStatusReader;
  const mockOptions: GitStatusReaderOptions = {
    cwd: "/test/repo",
  };

  gitStatusReader = new GitStatusReader(mockOptions);

  describe("isScpLikeGitUrl", () => {
    // Access private method for testing
    const isScpLikeGitUrl = (url: string) => {
      return (gitStatusReader as any).isScpLikeGitUrl(url);
    };

    test("should return true for SCP-like URLs with credentials", () => {
      expect(isScpLikeGitUrl("user@password:TabbyML/tabby.git")).toBe(true);
      expect(isScpLikeGitUrl("myuser@mypass123:owner/repo.git")).toBe(true);
      expect(isScpLikeGitUrl("user:pass@domain:port:TabbyML/tabby.git")).toBe(true);
    });

    test("should return false for standard git@ URLs", () => {
      expect(isScpLikeGitUrl("git@github.com:TabbyML/tabby.git")).toBe(false);
    });

    test("should return false for SSH URLs", () => {
      expect(isScpLikeGitUrl("ssh://git@github.com/TabbyML/tabby.git")).toBe(false);
    });

    test("should return false for HTTPS URLs", () => {
      expect(isScpLikeGitUrl("https://github.com/TabbyML/tabby.git")).toBe(false);
    });

    test("should return false for URLs without @ or :", () => {
      expect(isScpLikeGitUrl("TabbyML/tabby.git")).toBe(false);
      expect(isScpLikeGitUrl("file:///local/repo")).toBe(false);
    });
  });

  describe("sanitizeOriginUrl", () => {
    // Access private method for testing
    const sanitizeOriginUrl = (url: string | undefined) => {
      return (gitStatusReader as any).sanitizeOriginUrl(url);
    };

    test("should return undefined for undefined input", () => {
      expect(sanitizeOriginUrl(undefined)).toBeUndefined();
    });

    test("should handle HTTPS URLs with credentials", () => {
      const input = "https://user:password@github.com/TabbyML/tabby.git";
      const result = sanitizeOriginUrl(input);
      expect(result).toBe("https://github.com/TabbyML/tabby");
    });

    test("should handle HTTPS URLs without credentials", () => {
      const input = "https://github.com/TabbyML/tabby.git";
      const result = sanitizeOriginUrl(input);
      expect(result).toBe("https://github.com/TabbyML/tabby");
    });

    test("should handle git URLs with embedded credentials", () => {
      const input = "user@password:TabbyML/tabby.git";
      const result = sanitizeOriginUrl(input);
      expect(result).toBe("TabbyML/tabby.git");
    });

    test("should handle git URLs with complex credentials", () => {
      const input = "myuser@mypass123:owner/repo.git";
      const result = sanitizeOriginUrl(input);
      expect(result).toBe("owner/repo.git");
    });

    test("should preserve standard git@ SSH URLs", () => {
      const input = "git@github.com:TabbyML/tabby.git";
      const result = sanitizeOriginUrl(input);
      expect(result).toBe("https://github.com/TabbyML/tabby");
    });

    test("should preserve SSH URLs", () => {
      const input = "ssh://git@github.com/TabbyML/tabby.git";
      const result = sanitizeOriginUrl(input);
      expect(result).toBe("ssh://git@github.com/TabbyML/tabby.git");
    });

    test("should handle URLs with multiple colons correctly", () => {
      const input = "user:pass@domain:port:TabbyML/tabby.git";
      const result = sanitizeOriginUrl(input);
      expect(result).toBe("TabbyML/tabby.git");
    });

    test("should handle edge case with @ but no colon", () => {
      const input = "user@TabbyML/tabby.git";
      const result = sanitizeOriginUrl(input);
      expect(result).toBe("user@TabbyML/tabby.git");
    });

    test("should handle edge case with colon but no @", () => {
      const input = "https://github.com:443/TabbyML/tabby.git";
      const result = sanitizeOriginUrl(input);
      expect(result).toBe("https://github.com/TabbyML/tabby");
    });

    test("should handle URLs that don't match any pattern", () => {
      const input = "file:///local/repo";
      const result = sanitizeOriginUrl(input);
      expect(result).toBe("file:///local/repo");
    });
  });

  describe("constructor and basic functionality", () => {
    test("should create GitStatusReader with cwd option", () => {
      const reader = new GitStatusReader({ cwd: "/test/path" });
      expect(reader).toBeDefined();
    });

    test("should return undefined when no cwd is provided", async () => {
      const reader = new GitStatusReader({ cwd: "" });
      const result = await reader.readGitStatus();
      expect(result).toBeUndefined();
    });
  });
}); 