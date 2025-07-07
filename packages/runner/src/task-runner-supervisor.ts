import { getLogger } from "@ragdoll/common";
import type { TaskEvent } from "@ragdoll/db";
import type { TaskRunner, TaskRunnerState } from "./task-runner";

const sigtermError = new Error("SIGTERM received.");
const sigintError = new Error("SIGINT received.");

const logger = getLogger("TaskRunnerSupervisor");

export class TaskRunnerSupervisor {
  private abortController?: AbortController;

  constructor(
    private readonly runner: TaskRunner,
    private readonly isDaemon: boolean = false,
  ) {}

  start(): void {
    logger.info("Starting TaskRunner supervisor...");
    this.abortController = new AbortController();

    this.runner.state.subscribe((state) => {
      this.trackRunnerState(state);
    });

    this.startRunner();
  }

  stop(signal: "SIGTERM" | "SIGINT" = "SIGTERM"): void {
    logger.info(`Stopping TaskRunner supervisor due to ${signal}...`);

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = undefined;
    }

    const error = signal === "SIGINT" ? sigintError : sigtermError;
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
          } else if (progress.phase === "end") {
            logger.debug(`[Step ${progress.step}] Task loaded successfully.`);
          }
          break;
        case "executing-tool-call":
          if (progress.phase === "begin") {
            logger.info(
              `[Step ${progress.step}] Executing tool: ${progress.toolName}`,
            );
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
              logger.info(
                `[Step ${progress.step}] Tool ${progress.toolName} ✓`,
              );
            }
          }
          break;
        case "sending-message":
          if (progress.phase === "begin") {
            logger.debug(`[Step ${progress.step}] Sending message...`);
          } else if (progress.phase === "end") {
            logger.debug(`[Step ${progress.step}] Message sent successfully.`);
          }
          break;
      }
    } else if (runnerState.state === "stopped") {
      logger.info("Task runner stopped with result: ", runnerState.result);
      if (this.isDaemon) {
        // In daemon mode, always wait for status change when stopped
        logger.info(
          "Task stopped in daemon mode, monitoring for pending-model status...",
        );
        try {
          await this.waitForPendingModelStatus();
          this.startRunner();
        } catch (_erorr) {
          // ignore
        }
      } else {
        // In non-daemon mode, exit with success
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
        throw runnerState.error; // rethrow the error to exit the process with a non-zero code
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
            logger.info(
              "Task status changed to pending-model, restarting runner...",
            );
            unsubscribe();
            resolve();
          }
        },
      );

      // Handle abort signal
      if (this.abortController) {
        const onAbort = () => {
          unsubscribe();
          reject(
            new Error(
              "TaskRunnerSupervisor was aborted while waiting for pending-model",
            ),
          );
        };
        this.abortController.signal.addEventListener("abort", onAbort, {
          once: true,
        });
      }
    });
  }
}
