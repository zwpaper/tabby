import { type Signal, signal } from "@preact/signals-core";
import { TaskRunner } from "@ragdoll/runner/node";
import type { TaskRunnerState } from "@ragdoll/vscode-webui-bridge";
import { inject, injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";
import type { ApiClient } from "./auth-client";
import { getWorkspaceFolder } from "./fs";
import { getLogger } from "./logger";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { PochiEvents } from "./pochi-events";

const logger = getLogger("TaskRunnerManager");

@injectable()
@singleton()
export class TaskRunnerManager implements vscode.Disposable {
  private taskRunners: Map<number, TaskRunnerState> = new Map();
  readonly status: Signal<ReturnType<typeof this.buildStatus>>;

  constructor(
    @inject("ApiClient")
    private readonly apiClient: ApiClient,
    private readonly pochiEvents: PochiEvents,
  ) {
    logger.debug("TaskRunnerManager created.");
    this.status = signal(this.buildStatus());
  }

  async runTask(taskId: number) {
    if (this.taskRunners.has(taskId)) {
      const existingRunner = this.taskRunners.get(taskId);
      if (existingRunner?.status === "running") {
        logger.debug(`Task ${taskId} is already running.`);
        return;
      }
    }

    const taskState: TaskRunnerState = {
      status: "running",
    };
    try {
      logger.debug(`Starting task ${taskId}`);
      const taskRunner = new TaskRunner(
        this.apiClient,
        this.pochiEvents,
        taskId,
        { cwd: getWorkspaceFolder().uri.fsPath },
      );
      this.taskRunners.set(taskId, taskState);
      this.updateStatus();

      for await (const progress of taskRunner.start()) {
        logger.trace(`Task ${taskId} progress:`, progress);
        // FIXME(zhiming): If progress is trying to run a toolcall which is not auto-approved, throw an error.
        taskState.progress = progress;
        this.updateStatus();
      }
      logger.debug(`Task ${taskId} completed successfully.`);
    } catch (error) {
      logger.debug(`Task ${taskId} failed:`, error);
      taskState.error =
        error instanceof Error ? error.message : JSON.stringify(error);
    } finally {
      taskState.status = "stopped";
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
