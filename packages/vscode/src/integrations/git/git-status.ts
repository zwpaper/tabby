import { exec } from "node:child_process";
import { promisify } from "node:util";
import { injectable, singleton } from "tsyringe";
import * as vscode from "vscode";
import { getLogger } from "../../lib/logger";

const logger = getLogger("GitStatus");

@injectable()
@singleton()
export class GitStatus {
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
  private async readGitStatusImpl(): Promise<{
    currentBranch: string;
    mainBranch: string;
    statusOutput: string;
    logOutput: string;
  }> {
    const results = await Promise.allSettled([
      this.execGit("rev-parse --abbrev-ref HEAD"),
      this.detectMainBranch(),
      this.execGit("status --porcelain"),
      this.execGit('log -n 5 --pretty=format:"%h %s"'),
    ]);

    return {
      currentBranch:
        results[0].status === "fulfilled" ? results[0].value : "unknown",
      mainBranch:
        results[1].status === "fulfilled" ? results[1].value : "unknown",
      statusOutput: results[2].status === "fulfilled" ? results[2].value : "",
      logOutput: results[3].status === "fulfilled" ? results[3].value : "",
    };
  }

  /**
   * Format git status data into a readable string
   */
  private formatGitStatus(data: {
    currentBranch: string;
    mainBranch: string;
    statusOutput: string;
    logOutput: string;
  }): string {
    const { currentBranch, mainBranch, statusOutput, logOutput } = data;

    // Format the output as a string
    let result = `Current branch: ${currentBranch}\n`;
    result += `Main branch (you will usually use this for PRs): ${mainBranch}\n\n`;

    if (statusOutput) {
      result += "Status:\n";
      const lines = statusOutput.split("\n");
      for (const line of lines) {
        if (line.trim()) {
          result += `${line}\n`;
        }
      }
    }
    if (logOutput) {
      result += "\nRecent commits:\n";
      const commits = logOutput.split("\n");
      for (const commit of commits) {
        if (commit.trim()) {
          result += `${commit}\n`;
        }
      }
    }
    return result;
  }

  /**
   * Get Git status information for the current repository as a formatted string
   */
  public async readGitStatus(): Promise<string | undefined> {
    if (!this.rootPath) {
      logger.warn("No Git repository found");
      return undefined;
    }

    try {
      logger.debug("Reading Git status for repository", {
        path: this.rootPath,
      });

      const gitData = await this.readGitStatusImpl();

      logger.debug("Git status read completed", {
        currentBranch: gitData.currentBranch,
        mainBranch: gitData.mainBranch,
        hasChanges: gitData.statusOutput.length > 0,
      });

      return this.formatGitStatus(gitData);
    } catch (error) {
      logger.error("Error reading Git status", error);
    }
  }
}
