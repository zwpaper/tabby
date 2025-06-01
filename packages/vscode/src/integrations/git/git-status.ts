import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { GitStatus } from "@ragdoll/common";
import { injectable, singleton } from "tsyringe";
import * as vscode from "vscode";
import { getLogger } from "../../lib/logger";

const logger = getLogger("GitStatus");

@injectable()
@singleton()
export class GitStatusReader {
  private readonly execPromise = promisify(exec);
  private rootPath: string | undefined = undefined;

  constructor() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    this.rootPath = workspaceFolders?.[0]?.uri.fsPath;
  }

  /**
   * Execute a git command and return the output
   * Returns empty string if command fails or repository not found
   */
  private async execGit(command: string): Promise<string> {
    if (!this.rootPath) {
      throw new Error("No workspace folder found");
    }

    const { stdout } = await this.execPromise(`git ${command}`, {
      cwd: this.rootPath,
    });
    return stdout.trim();
  }

  /**
   * Detect the main branch using multiple fallback strategies
   */
  private async detectMainBranch(): Promise<string> {
    /*
     * Fallback strategies to detect the main branch
     * 1. Check if HEAD is a symbolic ref to the main branch
     * 2. Check if the main branch exists in the remote
     * 3. Check if the master branch exists in the remote
     */
    const strategies = [
      () => this.execGit("symbolic-ref refs/remotes/origin/HEAD --short"),
      () =>
        this.execGit("show-ref --verify --quiet refs/remotes/origin/main").then(
          () => "main",
        ),
      () =>
        this.execGit(
          "show-ref --verify --quiet refs/remotes/origin/master",
        ).then(() => "master"),
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result) {
          return result.replace("refs/remotes/origin/", "").trim();
        }
      } catch (error) {
        // skip to the next strategy
      }
    }
    return "";
  }

  /**
   * Implementation of git status collection
   * Collects all git data and returns it as structured data
   */
  private async readGitStatusImpl(): Promise<GitStatus> {
    const [origin, currentBranch, mainBranch, status, recentCommits] =
      await Promise.all([
        this.execGit("remote get-url origin").catch(() => undefined),
        this.execGit("rev-parse --abbrev-ref HEAD").catch(() => "unknown"),
        this.detectMainBranch().catch(() => "unknown"),
        this.execGit("status --porcelain").catch(() => ""),
        this.execGit('log -n 5 --pretty=format:"%h %s"')
          .then((x) => x.split("\n"))
          .catch(() => []),
      ]);

    return {
      origin,
      currentBranch,
      mainBranch,
      status,
      recentCommits,
    };
  }

  /**
   * Get Git status information for the current repository as a formatted string
   */
  public async readGitStatus(): Promise<GitStatus | undefined> {
    if (!this.rootPath) {
      logger.warn("No Git repository found");
      return undefined;
    }

    try {
      logger.trace("Reading Git status for repository", {
        path: this.rootPath,
      });

      return await this.readGitStatusImpl();
    } catch (error) {
      logger.error("Error reading Git status", error);
    }
  }
}
