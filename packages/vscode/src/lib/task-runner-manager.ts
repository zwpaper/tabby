import { type Signal, signal } from "@preact/signals-core";
import { TaskRunner } from "@ragdoll/runner";
import { inject, injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";
import type { ApiClient } from "./auth-client";
import { getLogger } from "./logger";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { PochiEvents } from "./pochi-events";

const logger = getLogger("TaskRunnerManager");

interface TaskRunnerState {
  runner: Promise<unknown>;
  status: "running" | "completed" | "error";
  error?: string;
}

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

    try {
      logger.debug(`Starting task ${taskId}`);
      const taskRunner = new TaskRunner(
        this.apiClient,
        this.pochiEvents,
        taskId,
      );
      const taskState: TaskRunnerState = {
        runner: taskRunner.start(),
        status: "running",
      };
      this.taskRunners.set(taskId, taskState);
      this.updateStatus();

      await taskState.runner;
      logger.debug(`Task ${taskId} completed successfully.`);
      taskState.status = "completed";
      this.updateStatus();
    } catch (error) {
      const state = this.taskRunners.get(taskId);
      if (state) {
        logger.debug(`Task ${taskId} failed:`, error);
        state.status = "error";
        state.error =
          error instanceof Error ? error.message : JSON.stringify(error);
        this.updateStatus();
      }
    }
  }

  private updateStatus() {
    this.status.value = this.buildStatus();
  }

  private buildStatus() {
    return Array.from(this.taskRunners.entries()).map(([taskId, state]) => ({
      taskId,
      status: state.status,
      error: state.error,
    }));
  }

  dispose() {
    logger.debug("TaskRunnerManager disposed.");
  }
}
