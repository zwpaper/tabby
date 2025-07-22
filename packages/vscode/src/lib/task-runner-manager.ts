import { type Signal, signal } from "@preact/signals-core";
import type { TaskRunnerState } from "@ragdoll/runner";
import { TaskRunner } from "@ragdoll/runner/node";
import { inject, injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";
import type { ApiClient } from "./auth-client";
import { getWorkspaceFolder, vscodeRipgrepPath } from "./fs";
import { getLogger } from "./logger";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { TokenStorage } from "./token-storage";

const logger = getLogger("TaskRunnerManager");

@injectable()
@singleton()
export class TaskRunnerManager implements vscode.Disposable {
  private taskRunnerMap: Map<
    string,
    { runner: TaskRunner; disposable: vscode.Disposable }
  > = new Map();
  readonly status: Signal<ReturnType<typeof this.buildStatus>>;

  constructor(
    @inject("ApiClient")
    private readonly apiClient: ApiClient,
    private readonly tokenStorage: TokenStorage,
  ) {
    logger.debug("TaskRunnerManager created.");
    this.status = signal(this.buildStatus());
  }

  startTask(
    uid: string,
    option?: { model?: string | undefined },
  ): Signal<TaskRunnerState> {
    const entry = this.taskRunnerMap.get(uid);
    const existingRunner = entry?.runner;
    if (existingRunner) {
      if (existingRunner.state.value.state === "running") {
        logger.debug(`Task runner ${uid} is already running.`);
      } else {
        logger.debug(`Restarting task runner ${uid}.`);
        existingRunner.start();
      }
      return existingRunner.state;
    }

    logger.debug(`Starting task runner ${uid}`);
    const taskRunner = new TaskRunner({
      uid,
      apiClient: this.apiClient,
      accessToken: this.tokenStorage.token.value || "",
      cwd: getWorkspaceFolder().uri.fsPath,
      rg: vscodeRipgrepPath,
      ...option,
    });

    const unsubscribe = taskRunner.state.subscribe((runnerState) => {
      logger.trace(
        `Task runner ${uid} state updated: ${JSON.stringify(runnerState)}`,
      );
      this.updateStatus();
    });

    this.taskRunnerMap.set(uid, {
      runner: taskRunner,
      disposable: { dispose: unsubscribe },
    });
    this.updateStatus();

    taskRunner.start();

    return taskRunner.state;
  }

  stopTask(uid: string) {
    const taskRunner = this.taskRunnerMap.get(uid);
    if (taskRunner) {
      logger.debug(`Stopping task runner ${uid}`);
      taskRunner.runner.stop();
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
        .map(([uid, entry]) => [uid, entry.runner.state.value]),
    );
  }

  dispose() {
    logger.debug("TaskRunnerManager disposed.");
    for (const [uid, entry] of this.taskRunnerMap.entries()) {
      if (entry.runner.state.value.state === "running") {
        logger.debug(`Stopping task runner ${uid} on dispose.`);
        entry.runner.stop();
      }
      entry.disposable.dispose();
    }
  }
}
