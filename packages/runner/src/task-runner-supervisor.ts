import { getLogger } from "@ragdoll/common";
import type { TaskEvent } from "@ragdoll/db";
import type { TaskRunner, TaskRunnerState } from "./task-runner";
import type { TaskRunnerOutputStream } from "./task-runner-output";

class AbortError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "AbortError";
  }
}

const sigtermError = new AbortError("SIGTERM received.");
const sigintError = new AbortError("SIGINT received.");

const logger = getLogger("TaskRunnerSupervisor");

export class TaskRunnerSupervisor {
  private abortController?: AbortController;

  constructor(
    private readonly runner: TaskRunner,
    private readonly output: TaskRunnerOutputStream,
    private readonly isDaemon: boolean = false,
  ) {}

  start(): void {
    logger.debug("Starting TaskRunner supervisor...");
    this.abortController = new AbortController();

    this.runner.state.subscribe((state) => {
      this.trackRunnerState(state);
    });

    this.startRunner();
  }

  stop(signal: "SIGTERM" | "SIGINT" = "SIGTERM"): void {
    logger.debug(`Stopping TaskRunner supervisor... (${signal})`);
    const error = signal === "SIGINT" ? sigintError : sigtermError;

    if (this.abortController) {
      this.abortController.abort(error);
      this.abortController = undefined;
    }
    this.runner.stop(error);
  }

  private startRunner(): void {
    this.runner.start();
  }

  private async trackRunnerState(runnerState: TaskRunnerState): Promise<void> {
    if (runnerState.state === "running") {
      const progress = runnerState.progress;
      switch (progress.type) {
        case "loading-task":
          if (progress.phase === "begin") {
            logger.debug(`[Step ${progress.step}] Loading task...`);
            this.output.updateIsLoading(true, "Loading task...");
          } else if (progress.phase === "end") {
            logger.debug(`[Step ${progress.step}] Task loaded successfully.`);
            this.output.updateIsLoading(false);
            this.output.updateMessage(runnerState.messages);
          }
          break;
        case "executing-tool-call":
          if (progress.phase === "begin") {
            logger.debug(
              `[Step ${progress.step}] Executing tool: ${progress.toolName}`,
            );
            this.output.updateToolCall({
              state: "call",
              toolCallId: progress.toolCallId,
              toolName: progress.toolName,
              args: progress.toolArgs,
            });
          } else if (progress.phase === "end") {
            const error =
              typeof progress.toolResult === "object" &&
              progress.toolResult !== null &&
              "error" in progress.toolResult &&
              progress.toolResult.error
                ? progress.toolResult.error
                : undefined;
            if (error) {
              logger.error(
                `[Step ${progress.step}] Tool ${progress.toolName} ✗ (${error})`,
              );
            } else {
              logger.debug(
                `[Step ${progress.step}] Tool ${progress.toolName} ✓`,
              );
            }
            this.output.updateToolCall({
              state: "result",
              toolCallId: progress.toolCallId,
              toolName: progress.toolName,
              args: progress.toolArgs,
              result: progress.toolResult,
            });
          }
          break;
        case "sending-message":
          if (progress.phase === "begin") {
            logger.debug(`[Step ${progress.step}] Sending message...`);
            this.output.updateMessage(runnerState.messages);
            this.output.updateIsLoading(true, "Sending message...");
          } else if (progress.phase === "end") {
            logger.debug(`[Step ${progress.step}] Message sent successfully.`);
            this.output.updateIsLoading(false);
          }
          break;
      }
    } else if (runnerState.state === "stopped") {
      logger.debug("Task runner stopped with result: ", runnerState.result);
      if (this.isDaemon) {
        await this.waitForTaskThenRestart();
      } else {
        // In non-daemon mode, exit with success
        this.output.finish();
        process.exit(0);
      }
    } else if (runnerState.state === "error") {
      if (runnerState.error === sigtermError) {
        logger.info(`Task runner exited: ${sigtermError.message}`);
        process.exit(143);
      } else if (runnerState.error === sigintError) {
        logger.info(`Task runner exited: ${sigintError.message}`);
        process.exit(130);
      } else {
        logger.error("Task runner failed with error: ", runnerState.error);
        if (this.isDaemon) {
          await this.waitForTaskThenRestart();
        } else {
          // In non-daemon mode, rethrow the error to exit the process
          this.output.printError(runnerState.error);
          throw runnerState.error;
        }
      }
    }
  }

  private async waitForTaskThenRestart() {
    try {
      logger.debug(
        "Task runner stopped in daemon mode, waiting for pending-model status...",
      );
      await this.waitForPendingModelStatus();

      logger.debug(
        "Task status changed to pending-model, restarting runner...",
      );
      this.startRunner();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        logger.debug("Waiting for pending-model was aborted.");
      } else {
        logger.error(
          "Unexpected error while waiting for pending-model and restarting runner: ",
          error,
        );
      }
    }
  }

  private async waitForPendingModelStatus(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Only use pochi event to avoid any conflicts
      const unsubscribe = this.runner.options.pochiEvents.subscribe<TaskEvent>(
        "task:status-changed",
        async ({ data }) => {
          if (data.uid !== this.runner.options.uid) {
            return;
          }

          if (data.status === "pending-model") {
            unsubscribe();
            resolve();
          }
        },
      );

      // Handle abort signal
      const abortSignal = this.abortController?.signal;
      if (abortSignal) {
        abortSignal.addEventListener(
          "abort",
          () => {
            unsubscribe();
            reject(abortSignal.reason);
          },
          {
            once: true,
          },
        );
      }
    });
  }
}
