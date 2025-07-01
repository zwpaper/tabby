import { mkdir } from "node:fs/promises";
import * as path from "node:path";
import { getWorkspaceFolder } from "@/lib/fs";
import { getLogger } from "@ragdoll/common";
import { inject, injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";
import { ShadowGitRepo } from "./shadow-git-repo";
import { Deferred, hashWorkingDir as hashDir, toErrorMessage } from "./util";

const logger = getLogger("CheckpointService");

@injectable()
@singleton()
export class CheckpointService implements vscode.Disposable {
  private shadowGit: ShadowGitRepo | undefined;
  private readyDefer = new Deferred<void>();
  private initialized = false;

  private get cwdHash() {
    return hashDir(getWorkspaceFolder().uri.fsPath);
  }

  constructor(
    @inject("vscode.ExtensionContext")
    private readonly context: vscode.ExtensionContext,
  ) {}

  /**
   * Lazy initializes the checkpoint service.
   * @returns A promise that resolves when the checkpoint service is initialized.
   */
  private async ensureInitialized() {
    if (!this.initialized) {
      this.initialized = true;
      await this.init();
    }
    return this.readyDefer.promise;
  }

  private async init() {
    try {
      const gitPath = await this.getShadowGitPath();
      this.shadowGit = await ShadowGitRepo.getOrCreate(
        gitPath,
        getWorkspaceFolder().uri.fsPath,
      );
      logger.trace("Shadow Git repository initialized at", gitPath);
      this.readyDefer.resolve();
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      logger.error("Failed to initialize Shadow Git repository:", errorMessage);
      this.readyDefer.reject(
        new Error(`Failed to initialize checkpoint service: ${errorMessage}`),
      );
    }
  }

  /**
   * Saves a checkpoint for the current workspace.
   * @param message A message to associate with the checkpoint.
   * @returns The commit hash of the created checkpoint.
   */
  saveCheckpoint = async (message: string): Promise<string> => {
    logger.trace(`Saving checkpoint with message: ${message}`);

    await this.ensureInitialized();

    if (!this.shadowGit) {
      throw new Error("Shadow Git repository not initialized");
    }

    try {
      await this.shadowGit.stageAll();
      const commitMessage = `checkpoint-${this.cwdHash}-${message}`;
      const commitHash = await this.shadowGit.commit(commitMessage);
      logger.trace(
        `Successfully saved checkpoint with message: ${message}, commit hash: ${commitHash}`,
      );
      return commitHash;
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      const fullErrorMessage = `Failed to save checkpoint with message: ${message}: ${errorMessage}`;
      logger.error(fullErrorMessage, { error, cwdHash: this.cwdHash });
      throw new Error(fullErrorMessage);
    }
  };

  /**
   * Restores a checkpoint for the current workspace.
   * @param commitHash The commit hash to restore the checkpoint from.
   * @returns A promise that resolves when the checkpoint is restored.
   */
  restoreCheckpoint = async (commitHash: string): Promise<void> => {
    logger.trace(`Restoring checkpoint for commit hash: ${commitHash}`);
    await this.ensureInitialized();

    if (!this.shadowGit) {
      throw new Error("Shadow Git repository not initialized");
    }

    await this.shadowGit.reset(commitHash);
  };

  private async getShadowGitPath() {
    const globalStoragePath = this.context.globalStorageUri.fsPath;
    const checkpointsDir = path.join(
      globalStoragePath,
      "checkpoints",
      this.cwdHash,
    );
    await mkdir(checkpointsDir, { recursive: true });
    const gitPath = path.join(checkpointsDir, ".git");
    return gitPath;
  }

  dispose() {
    this.shadowGit?.dispose();
  }
}
