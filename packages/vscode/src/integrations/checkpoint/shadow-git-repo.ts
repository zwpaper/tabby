import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getLogger } from "@ragdoll/common";
import simpleGit, { type SimpleGit } from "simple-git";
import type * as vscode from "vscode";
import { writeExcludesFile } from "./shadow-git-excludes";
import { isFileExists, toErrorMessage } from "./util";

export type GitDiff = {
  relative: string;
  absolute: string;
  before: string;
  after: string;
};

const logger = getLogger("ShadowGitRepo");

export class ShadowGitRepo implements vscode.Disposable {
  private git: SimpleGit;

  static async getOrCreate(
    gitPath: string,
    workspaceDir: string,
  ): Promise<ShadowGitRepo> {
    try {
      await simpleGit().version();
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      throw new Error(
        `Git must be installed to use checkpoints: ${errorMessage}`,
      );
    }

    try {
      const shadowGitRepo = new ShadowGitRepo(gitPath, workspaceDir);
      await shadowGitRepo.init();
      return shadowGitRepo;
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      throw new Error(
        `Failed to create shadow git repository: ${errorMessage}`,
      );
    }
  }

  constructor(
    /**
     * Path to the bare git repository directory for the shadow repository.
     */
    private gitPath: string,
    private workspaceDir: string,
  ) {
    // For bare repository, we initialize simple-git with the bare repository directory
    this.git = simpleGit(this.gitPath);
  }

  async init() {
    try {
      // Check if bare repository already exists by looking for git files
      const headFile = path.join(this.gitPath, "HEAD");
      const exists = await isFileExists(headFile);

      if (exists) {
        logger.trace(
          `Shadow Git repository already exists at ${this.gitPath}.`,
        );
        // For bare repository, check worktree config
        try {
          const worktreeResult = await this.git.raw([
            "config",
            "core.worktree",
          ]);
          const currentWorktree = worktreeResult.trim();
          if (currentWorktree && currentWorktree !== this.workspaceDir) {
            throw new Error(
              `The worktree for the repository at ${this.gitPath} is already set to ${currentWorktree}, but expected ${this.workspaceDir}.`,
            );
          }
          // If worktree is not set, set it
          if (!currentWorktree) {
            await this.git.raw(["config", "core.worktree", this.workspaceDir]);
            logger.trace(
              `Set worktree to ${this.workspaceDir} for existing repository.`,
            );
          }
        } catch (configError) {
          // If config doesn't exist, set it
          await this.git.raw(["config", "core.worktree", this.workspaceDir]);
          logger.trace(
            `Set worktree to ${this.workspaceDir} for existing repository.`,
          );
        }
        await writeExcludesFile(this.gitPath, this.workspaceDir);
        return;
      }

      // Initialize bare repository
      await this.git.init(["--bare"]);

      // Configure the bare repository
      await this.git.raw(["config", "core.worktree", this.workspaceDir]);
      await this.git.raw(["config", "commit.gpgSign", "false"]);
      await this.git.raw(["config", "user.name", "Pochi Checkpoint"]);
      await this.git.raw([
        "config",
        "user.email",
        "pochi-checkpoint@tabbyml.com",
      ]);

      logger.trace(`Initialized shadow Git repository at ${this.gitPath}.`);

      await writeExcludesFile(this.gitPath, this.workspaceDir);

      await this.stageAll();
      await this.commit("Pochi Shadow Repo Initial Commit");
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      logger.error(
        `Failed to initialize shadow git repository: ${errorMessage}`,
        {
          error,
          gitPath: this.gitPath,
          workspaceDir: this.workspaceDir,
        },
      );
      throw new Error(
        `Failed to initialize shadow git repository: ${errorMessage}`,
      );
    }
  }

  async stageAll() {
    try {
      if (!this.git) {
        throw new Error("Git instance is not initialized");
      }
      // For bare repository with worktree, use --work-tree flag
      await this.git.raw([
        "--work-tree",
        this.workspaceDir,
        "add",
        ".",
        "--ignore-errors",
      ]);
      logger.trace(`Staged all changes in the repository at ${this.gitPath}.`);
      return true;
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      const message = `Failed to stage all changes in the repository at ${this.gitPath}: ${errorMessage}`;
      logger.error(message, {
        error,
        gitPath: this.gitPath,
        workspaceDir: this.workspaceDir,
      });
      throw new Error(message);
    }
  }

  async commit(commitMessage: string): Promise<string> {
    try {
      if (!this.git) {
        throw new Error("Git instance is not initialized");
      }
      // For bare repository with worktree, use --work-tree flag
      const result = await this.git.raw([
        "--work-tree",
        this.workspaceDir,
        "commit",
        "-m",
        commitMessage,
        "--allow-empty",
        "--no-verify",
      ]);

      // Extract commit hash from the output
      const commitHashMatch = result.match(/\[[\w\s]+ ([a-f0-9]+)\]/);
      const commitHash = commitHashMatch ? commitHashMatch[1] : "";

      logger.trace(
        `Committed changes in the repository at ${this.gitPath} with message: ${commitMessage}`,
      );
      return commitHash;
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      const message = `Failed to commit changes in the repository at ${this.gitPath}: ${errorMessage}`;
      logger.error(message, {
        error,
        gitPath: this.gitPath,
        workspaceDir: this.workspaceDir,
        commitMessage,
      });
      throw new Error(message);
    }
  }

  async reset(commitHash: string) {
    try {
      if (!this.git) {
        throw new Error("Git instance is not initialized");
      }
      // For bare repository with worktree, use --work-tree flag
      await this.git.raw([
        "--work-tree",
        this.workspaceDir,
        "reset",
        "--hard",
        commitHash,
      ]);
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      logger.error(
        `Failed to reset the repository at ${this.gitPath} to commit ${commitHash}: ${errorMessage}`,
      );
      throw new Error(
        `Failed to reset the repository at ${this.gitPath} to commit ${commitHash}: ${errorMessage}`,
      );
    }
  }

  async resetLatest() {
    try {
      const log = await this.git.log();
      if (log.latest) {
        await this.reset(log.latest.hash);
        logger.trace(
          `Reset the repository at ${this.gitPath} to the latest commit: ${log.latest.hash}`,
        );
      } else {
        throw new Error("No commits found in the repository.");
      }
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      logger.error(
        `Failed to reset the repository at ${this.gitPath} to the latest commit: ${errorMessage}`,
      );
      throw new Error(
        `Failed to reset the repository at ${this.gitPath} to the latest commit: ${errorMessage}`,
      );
    }
  }

  async getDiff(from: string, to?: string): Promise<GitDiff[]> {
    const diffRange = to ? `${from}..${to}` : from;
    const diffSummary = await this.git.diffSummary([diffRange]);
    const result = [];
    for (const file of diffSummary.files) {
      const filePath = file.file;
      const absolutePath = path.join(this.workspaceDir, filePath);

      let beforeContent = "";
      try {
        beforeContent = await this.git.show([`${from}:${filePath}`]);
      } catch (_) {
        // file didn't exist in older commit => remains empty
      }

      let afterContent = "";
      if (to) {
        try {
          afterContent = await this.git.show([`${to}:${filePath}`]);
        } catch (_) {
          // file didn't exist
        }
      } else {
        try {
          afterContent = await fs.readFile(absolutePath, "utf8");
        } catch (_) {
          // file might be deleted
        }
      }

      result.push({
        relative: filePath,
        absolute: absolutePath,
        before: beforeContent,
        after: afterContent,
      });
    }
    return result;
  }

  dispose() {
    this.git = undefined as unknown as SimpleGit; // Clear the git instance
  }
}
