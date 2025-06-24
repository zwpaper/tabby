import { type Signal, signal } from "@preact/signals-core";
import type { TaskRunnerState } from "@ragdoll/runner";
import { TaskRunner } from "@ragdoll/runner/node";
import type { TaskRunnerOptions } from "@ragdoll/vscode-webui-bridge";
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
  private taskRunnerMap: Map<string, TaskRunner> = new Map();
  readonly status: Signal<ReturnType<typeof this.buildStatus>>;

  constructor(
    @inject("ApiClient")
    private readonly apiClient: ApiClient,
    private readonly pochiEvents: PochiEvents,
  ) {
    logger.debug("TaskRunnerManager created.");
    this.status = signal(this.buildStatus());
  }

  startTask(uid: string, option?: TaskRunnerOptions): Signal<TaskRunnerState> {
    const existingRunner = this.taskRunnerMap.get(uid);
    if (existingRunner) {
      if (existingRunner.state.value.state === "running") {
        logger.debug(`Task runner ${uid} is already running.`);
      } else {
        existingRunner.start();
      }
      return existingRunner.state;
    }

    logger.debug(`Starting task runner ${uid}`);
    const taskRunner = new TaskRunner({
      uid,
      apiClient: this.apiClient,
      pochiEvents: this.pochiEvents,
      cwd: getWorkspaceFolder().uri.fsPath,
      rg: vscodeRipgrepPath,
      ...option,
    });
    this.taskRunnerMap.set(uid, taskRunner);
    this.updateStatus();

    taskRunner.start();
    taskRunner.state.subscribe((runnerState) => {
      logger.trace(
        `Task runner ${uid} state updated: ${JSON.stringify(runnerState)}`,
      );
      this.updateStatus();
    });

    return taskRunner.state;
  }

  stopTask(uid: string) {
    const taskRunner = this.taskRunnerMap.get(uid);
    if (taskRunner) {
      logger.debug(`Stopping task runner ${uid}`);
      taskRunner.stop();
      this.taskRunnerMap.delete(uid);
      this.updateStatus();
    } else {
      logger.warn(`Task runner ${uid} not found.`);
    }
  }

  private updateStatus() {
    this.status.value = this.buildStatus();
  }

  private buildStatus() {
    return Object.fromEntries(
      this.taskRunnerMap
        .entries()
        .map(([uid, runner]) => [uid, runner.state.value]),
    );
  }

  dispose() {
    logger.debug("TaskRunnerManager disposed.");
  }
}
