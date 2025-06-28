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
    const gitPath = await this.getShadowGitPath();
    this.shadowGit = await ShadowGitRepo.getOrCreate(
      gitPath,
      getWorkspaceFolder().uri.fsPath,
    );
    logger.trace("Shadow Git repository initialized at", gitPath);
    this.readyDefer.resolve();
  }

  /**
   * Saves a checkpoint for the given tool call ID.
   * @param toolCallId The ID of the tool call to save the checkpoint for.
   * @returns The commit hash of the created checkpoint.
   */
  saveCheckpoint = async (toolCallId: string): Promise<string> => {
    logger.trace(`Saving checkpoint for tool call ID: ${toolCallId}`);

    await this.ensureInitialized();

    if (!this.shadowGit) {
      throw new Error("Shadow Git repository not initialized");
    }

    try {
      await this.shadowGit.stageAll();
      const commitMessage = `checkpoint-${this.cwdHash}-${toolCallId}`;
      const commitHash = await this.shadowGit.commit(commitMessage);
      logger.trace(
        `Successfully saved checkpoint for tool call ID: ${toolCallId}, commit hash: ${commitHash}`,
      );
      return commitHash;
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      const message = `Failed to save checkpoint for tool call ID: ${toolCallId}: ${errorMessage}`;
      logger.error(message, { error, toolCallId, cwdHash: this.cwdHash });
      throw new Error(message);
    }
  };

  /**
   * @param commitHash  - The commit hash to restore to. If not provided, restores to the latest checkpoint.
   */
  restoreCheckpoint = async (commitHash?: string): Promise<void> => {
    logger.trace(
      `Restoring checkpoint for commit hash: ${commitHash ?? "latest"}`,
    );
    await this.ensureInitialized();

    if (!this.shadowGit) {
      throw new Error("Shadow Git repository not initialized");
    }

    if (commitHash) {
      return await this.shadowGit.reset(commitHash);
    }
    return await this.shadowGit.resetLatest();
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
