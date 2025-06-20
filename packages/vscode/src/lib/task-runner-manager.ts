import { type Signal, signal } from "@preact/signals-core";
import { TaskRunner } from "@ragdoll/runner/node";
import type {
  TaskRunnerOptions,
  TaskRunnerState,
} from "@ragdoll/vscode-webui-bridge";
import { inject, injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";
import type { ApiClient } from "./auth-client";
import { getWorkspaceFolder, vscodeRipgrepPath } from "./fs";
import { getLogger } from "./logger";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { PochiEvents } from "./pochi-events";

const logger = getLogger("TaskRunnerManager");

@injectable()
@singleton()
export class TaskRunnerManager implements vscode.Disposable {
  private taskRunners: Map<string, TaskRunnerState> = new Map();
  private taskRunnersStop: Map<string, () => void> = new Map();
  readonly status: Signal<ReturnType<typeof this.buildStatus>>;

  constructor(
    @inject("ApiClient")
    private readonly apiClient: ApiClient,
    private readonly pochiEvents: PochiEvents,
  ) {
    logger.debug("TaskRunnerManager created.");
    this.status = signal(this.buildStatus());
  }

  async runTask(uid: string, option?: TaskRunnerOptions) {
    const stopTask = () => {
      logger.debug(`Task ${uid} aborted.`);
      this.taskRunnersStop.get(uid)?.();
      this.taskRunnersStop.delete(uid);
    };
    option?.abortSignal?.addEventListener("abort", stopTask);
    if (this.taskRunners.has(uid)) {
      const existingRunner = this.taskRunners.get(uid);
      if (existingRunner?.status === "running") {
        logger.debug(`Task ${uid} is already running.`);
        return;
      }
    }

    const taskState: TaskRunnerState = {
      status: "running",
    };
    try {
      logger.debug(`Starting task ${uid}`);
      const taskRunner = new TaskRunner(this.apiClient, this.pochiEvents, uid, {
        cwd: getWorkspaceFolder().uri.fsPath,
        rg: vscodeRipgrepPath,
        ...option,
      });
      this.taskRunners.set(uid, taskState);
      this.taskRunnersStop.set(uid, () => taskRunner.stop());
      this.updateStatus();

      for await (const progress of taskRunner.start()) {
        logger.trace(`Task ${uid} progress:`, progress);
        // FIXME(zhiming): If progress is trying to run a toolcall which is not auto-approved, throw an error.
        taskState.progress = progress;
        if (progress.type === "loading-task" && progress.phase === "end") {
          taskState.task = progress.task;
        }
        this.updateStatus();
      }
      logger.debug(`Task ${uid} completed successfully.`);
    } catch (error) {
      logger.debug(`Task ${uid} failed:`, error);
      taskState.error =
        error instanceof Error ? error.message : JSON.stringify(error);
    } finally {
      taskState.status = "stopped";
      option?.abortSignal?.removeEventListener("abort", stopTask);
      this.taskRunnersStop.delete(uid);
      this.updateStatus();
    }
  }

  private updateStatus() {
    this.status.value = this.buildStatus();
  }

  private buildStatus() {
    return Object.fromEntries(this.taskRunners.entries());
  }

  dispose() {
    logger.debug("TaskRunnerManager disposed.");
  }
}
