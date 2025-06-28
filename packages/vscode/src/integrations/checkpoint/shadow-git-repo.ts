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
     * Path to the .git directory for the shadow repository.
     */
    private gitPath: string,
    private workspaceDir: string,
  ) {
    this.git = simpleGit(path.dirname(this.gitPath));
  }

  async init() {
    try {
      const exists = await isFileExists(this.gitPath);
      if (exists) {
        logger.trace(
          `Shadow Git repository already exists at ${this.gitPath}.`,
        );
        const worktree = await this.git.getConfig("core.worktree");
        if (worktree.value !== this.workspaceDir) {
          throw new Error(
            `The worktree for the repository at ${this.gitPath} is already set to ${worktree.value}, but expected ${this.workspaceDir}.`,
          );
        }
        await writeExcludesFile(this.gitPath, this.workspaceDir);
        return;
      }

      // TODO: Check nested git repositories

      await this.git.init();
      await this.git.addConfig("core.worktree", this.workspaceDir);
      await this.git.addConfig("commit.gpgSign", "false");
      await this.git.addConfig("user.name", "Pochi Checkpoint");
      await this.git.addConfig("user.email", "pochi-checkpoint@tabbyml.com");

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
      await this.git.add([".", "--ignore-errors"]);
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
      const result = await this.git.commit(commitMessage, {
        "--allow-empty": null,
        "--no-verify": null,
      });
      logger.trace(
        `Committed changes in the repository at ${this.gitPath} with message: ${commitMessage}`,
      );
      return result.commit;
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
      await this.git.reset(["--hard", commitHash]);
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
