import { exec } from "node:child_process";
import { promisify } from "node:util";
import { injectable, singleton } from "tsyringe";
import { getWorkspaceFolder } from "../../lib/fs";
import { getLogger } from "../../lib/logger";

const logger = getLogger("GitStatus");

@injectable()
@singleton()
export class GitStatus {
  private readonly execPromise = promisify(exec);
  private rootPath: string | undefined = undefined;

  constructor() {
    this.rootPath = getWorkspaceFolder().uri.fsPath;
  }

  /**
   * Execute a git command and return the output
   * Returns empty string if command fails or repository not found
   */
  private async execGit(command: string): Promise<string> {
    if (!this.rootPath) {
      logger.warn("No Git repository found");
      return "";
    }

    try {
      const { stdout } = await this.execPromise(`git ${command}`, {
        cwd: this.rootPath,
      });
      return stdout.trim();
    } catch (error) {
      logger.trace(`Git command failed: git ${command}`, error);
      return "";
    }
  }

  /**
   * Implementation of git status collection
   * Collects all git data and returns it as structured data
   */
  private async readGitStatusImpl(): Promise<
    | {
        currentBranch: string;
        mainBranch: string;
        statusOutput: string;
        logOutput: string;
      }
    | undefined
  > {
    const currentBranch = await this.execGit("rev-parse --abbrev-ref HEAD");
    if (!currentBranch) {
      logger.warn("No current branch found or repository is empty");
      return undefined;
    }
    const mainBranch = await this.execGit(
      "symbolic-ref refs/remotes/origin/HEAD --short",
    );
    if (!mainBranch) {
      logger.warn("No main branch found or repository is empty");
      return undefined;
    }
    const statusOutput = await this.execGit("status --porcelain");
    const logOutput = await this.execGit('log -n 5 --pretty=format:"%h %s"');

    return {
      currentBranch,
      mainBranch,
      statusOutput,
      logOutput,
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
  async readGitStatus(): Promise<string> {
    if (!this.rootPath) {
      logger.warn("No Git repository found");
      return "";
    }

    try {
      const gitData = await this.readGitStatusImpl();
      if (!gitData) {
        return "";
      }
      return this.formatGitStatus(gitData);
    } catch (error) {
      return "";
    }
  }
}
