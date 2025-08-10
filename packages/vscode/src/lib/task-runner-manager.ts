import { type Signal, signal } from "@preact/signals-core";
import type { TaskRunnerState } from "@ragdoll/runner";
import { TaskRunner, createStore } from "@ragdoll/runner/node";
import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import { injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";
import { getWorkspaceFolder, vscodeRipgrepPath } from "./fs";
import { getLogger } from "./logger";
import type { TokenStorage } from "./token-storage";

const logger = getLogger("TaskRunnerManager");

@injectable()
@singleton()
export class TaskRunnerManager implements vscode.Disposable {
  private taskRunnerMap: Map<
    string,
    { runner: TaskRunner; disposable: vscode.Disposable }
  > = new Map();
  readonly status: Signal<ReturnType<typeof this.buildStatus>>;

  constructor(private readonly tokenStorage: TokenStorage) {
    logger.debug("TaskRunnerManager created.");
    this.status = signal(this.buildStatus());
  }

  async startTask(
    uid: string,
    option?: { model?: string },
  ): Promise<Signal<TaskRunnerState>> {
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
    const cwd = getWorkspaceFolder().uri.fsPath;
    const store = await createStore(cwd);
    // FIXME(jackson): support BYOK settings / modelEndpointId settings
    const llm = {
      type: "pochi" as const,
      modelId: "zai/glm-4.5",
      token: this.tokenStorage.token.value || "",
      server: getServerBaseUrl(),
    };
    const taskRunner = new TaskRunner({
      uid,
      llm,
      store,
      cwd,
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
