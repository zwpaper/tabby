import { getLogger } from "@ragdoll/common";
import chalk from "chalk";
import { stepToString } from "./lib/step-count";
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
    if (this.runner.state.value.state === "running") {
      this.runner.stop(error);
    }
  }

  private startRunner(): void {
    this.runner.start();
  }

  private async trackRunnerState(runnerState: TaskRunnerState): Promise<void> {
    if (runnerState.state === "running") {
      const progress = runnerState.progress;
      const stepInfo = stepToString(progress.step);
      switch (progress.type) {
        case "loading-task":
          if (progress.phase === "begin") {
            logger.debug(`[${stepInfo}] Loading task...`);
            this.output.startLoading("Loading task...");
          } else if (progress.phase === "end") {
            logger.debug(`[${stepInfo}] Task loaded successfully.`);
            this.output.stopLoading();
            this.output.updateMessage(runnerState.messages);
          }
          break;
        case "executing-tool-call":
          if (progress.phase === "begin") {
            logger.debug(`[${stepInfo}] Executing tool: ${progress.toolName}`);
            this.output.updateToolCall({
              // @ts-expect-error
              type: `tool-${progress.toolName}`,
              state: "input-available",
              toolCallId: progress.toolCallId,
              // @ts-expect-error
              input: progress.toolArgs,
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
                `[${stepInfo}] Tool ${progress.toolName} ✗ (${error})`,
              );
            } else {
              logger.debug(`[${stepInfo}] Tool ${progress.toolName} ✓`);
            }
            this.output.updateToolCall({
              // @ts-expect-error
              type: `tool-${progress.toolName}`,
              state: "output-available",
              toolCallId: progress.toolCallId,
              // @ts-expect-error
              input: progress.toolArgs,
              // @ts-expect-error
              output: progress.toolResult,
            });
          }
          break;
        case "sending-message":
          if (progress.phase === "begin") {
            logger.debug(`[${stepInfo}] Sending message...`);
            this.output.updateMessage(runnerState.messages);
            this.output.startLoading("Sending message...");
          } else if (progress.phase === "end") {
            logger.debug(`[${stepInfo}] Message sent successfully.`);
            this.output.stopLoading();
            if (progress.messageReason === "next") {
              const separator = "─".repeat(
                Math.min(process.stdout.columns || 80, 50),
              );

              this.output.printText(
                chalk.dim(`\n${separator}\n`) +
                  chalk.dim("✨ Round complete\n") +
                  chalk.dim(`${separator}\n\n`),
              );
            }
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
        this.output.finish();
        process.exit(143);
      } else if (runnerState.error === sigintError) {
        logger.info(`Task runner exited: ${sigintError.message}`);
        this.output.finish();
        process.exit(130);
      } else {
        logger.error("Task runner failed with error: ", runnerState.error);
        if (this.isDaemon) {
          await this.waitForTaskThenRestart();
        } else {
          // In non-daemon mode, rethrow the error to exit the process
          this.output.printError(runnerState.error);
          this.output.finish();
          throw runnerState.error;
        }
      }
    }
  }

  private async waitForTaskThenRestart() {
    this.output.printText(
      chalk.dim(chalk.italic("Waiting for task to be updated...")),
    );
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
    // FIXME: implement this
    return new Promise((resolve) => setTimeout(resolve, 1000000000000));
  }
}
