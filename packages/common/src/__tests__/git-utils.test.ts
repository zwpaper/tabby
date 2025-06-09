import { describe, expect, test } from "bun:test";
import {
  parseGitOriginUrl,
  isGitHubUrl,
  getGitPlatformIcon,
} from "../git-utils";

describe("git-utils", () => {
  describe("parseGitOriginUrl", () => {
    test("should parse GitHub HTTPS URLs", () => {
      const url = "https://github.com/TabbyML/tabby";
      const result = parseGitOriginUrl(url);
      
      expect(result).toEqual({
        platform: "github",
        owner: "TabbyML",
        repo: "tabby",
        shorthand: "TabbyML/tabby",
        webUrl: "https://github.com/TabbyML/tabby",
      });
    });

    test("should parse GitHub SSH URLs", () => {
      const url = "git@github.com:TabbyML/tabby.git";
      const result = parseGitOriginUrl(url);
      
      expect(result).toEqual({
        platform: "github",
        owner: "TabbyML",
        repo: "tabby",
        shorthand: "TabbyML/tabby",
        webUrl: "https://github.com/TabbyML/tabby",
      });
    });

    test("should parse GitHub URLs with .git suffix", () => {
      const url = "https://github.com/TabbyML/tabby.git";
      const result = parseGitOriginUrl(url);
      
      expect(result).toEqual({
        platform: "github",
        owner: "TabbyML",
        repo: "tabby",
        shorthand: "TabbyML/tabby",
        webUrl: "https://github.com/TabbyML/tabby",
      });
    });

    test("should parse GitLab HTTPS URLs", () => {
      const url = "https://gitlab.com/user/project";
      const result = parseGitOriginUrl(url);
      
      expect(result).toEqual({
        platform: "gitlab",
        owner: "user",
        repo: "project",
        shorthand: "user/project",
        webUrl: "https://gitlab.com/user/project",
      });
    });

    test("should parse GitLab SSH URLs", () => {
      const url = "git@gitlab.com:user/project.git";
      const result = parseGitOriginUrl(url);
      
      expect(result).toEqual({
        platform: "gitlab",
        owner: "user",
        repo: "project",
        shorthand: "user/project",
        webUrl: "https://gitlab.com/user/project",
      });
    });

    test("should parse Bitbucket HTTPS URLs", () => {
      const url = "https://bitbucket.org/user/project";
      const result = parseGitOriginUrl(url);
      
      expect(result).toEqual({
        platform: "bitbucket",
        owner: "user",
        repo: "project",
        shorthand: "user/project",
        webUrl: "https://bitbucket.org/user/project",
      });
    });

    test("should parse Bitbucket SSH URLs", () => {
      const url = "git@bitbucket.org:user/project.git";
      const result = parseGitOriginUrl(url);
      
      expect(result).toEqual({
        platform: "bitbucket",
        owner: "user",
        repo: "project",
        shorthand: "user/project",
        webUrl: "https://bitbucket.org/user/project",
      });
    });

    test("should return null for unsupported URLs", () => {
      const urls = [
        "https://example.com/user/repo",
        "git@example.com:user/repo.git",
        "not-a-url",
        "",
      ];

      for (const url of urls) {
        expect(parseGitOriginUrl(url)).toBeNull();
      }
    });

    test("should return null for empty or null input", () => {
      expect(parseGitOriginUrl("")).toBeNull();
      expect(parseGitOriginUrl(null as any)).toBeNull();
      expect(parseGitOriginUrl(undefined as any)).toBeNull();
    });
  });

  describe("isGitHubUrl", () => {
    test("should return true for GitHub URLs", () => {
      const urls = [
        "https://github.com/TabbyML/tabby",
        "git@github.com:TabbyML/tabby.git",
        "https://github.com/user/repo.git",
      ];

      for (const url of urls) {
        expect(isGitHubUrl(url)).toBe(true);
      }
    });

    test("should return false for non-GitHub URLs", () => {
      const urls = [
        "https://gitlab.com/user/project",
        "git@bitbucket.org:user/project.git",
        "https://example.com/user/repo",
        "",
        "not-a-url",
      ];

      for (const url of urls) {
        expect(isGitHubUrl(url)).toBe(false);
      }
    });
  });

  describe("getGitPlatformIcon", () => {
    test("should return correct icons for known platforms", () => {
      expect(getGitPlatformIcon("github")).toBe("github");
      expect(getGitPlatformIcon("gitlab")).toBe("gitlab");
      expect(getGitPlatformIcon("bitbucket")).toBe("bitbucket");
    });

    test("should return default icon for unknown platforms", () => {
      expect(getGitPlatformIcon("unknown")).toBe("git");
    });
  });
});

