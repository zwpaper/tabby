import { type AppType, createPochiEventSource } from "@ragdoll/server";
import { hc } from "hono/client";

import { Command } from "@commander-js/extra-typings";
import { getLogger } from "@ragdoll/common";
import * as commander from "commander";
import { findRipgrep } from "./lib/find-ripgrep";
import { TaskRunner, type TaskRunnerState } from "./task-runner";

const program = new Command();
program.name("pochi-runner").description("Pochi cli runner");

const logger = getLogger("Pochi");

program
  .argument("[prompt]", "Creating a new task with the given prompt")
  .option("--url <url>", "Pochi server url", "https://app.getpochi.com")
  .option("--task <uid>", "Task uid to execute", process.env.POCHI_TASK_ID)
  .requiredOption("--cwd <cwd>", "Current working directory", process.cwd())
  .requiredOption(
    "--rg <path>",
    "Path to ripgrep binary",
    findRipgrep() || undefined,
  )
  .requiredOption(
    "--token <token>",
    "Pochi session token",
    process.env.POCHI_SESSION_TOKEN,
  )
  .action(async (prompt, options) => {
    if (!options.task && !prompt) {
      throw new commander.InvalidArgumentError(
        "Error: Either --task or a prompt must be provided",
      );
    }

    const apiClient = hc<AppType>(options.url, {
      headers: {
        Authorization: `Bearer ${options.token}`,
      },
    });

    const pochiEvents = createPochiEventSource(options.url, options.token);

    let uid = options.task;
    if (prompt) {
      const response = await apiClient.api.tasks.$post({
        json: {
          prompt,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create task: ${error}`);
      }

      const task = await response.json();
      uid = task.uid;
    }

    logger.info(
      `You can visit ${options.url}/share/${uid} to see the task progress.`,
    );

    // Use existing task ID mode
    const runner = new TaskRunner({
      uid,
      apiClient,
      pochiEvents,
      cwd: options.cwd,
      rg: options.rg,
    });

    runner.state.subscribe((runnerState) => {
      trackRunnerState(runnerState);
    });

    runner.start();
  });

function trackRunnerState(runnerState: TaskRunnerState) {
  const output = logger;
  if (runnerState.state === "running") {
    const progress = runnerState.progress;
    switch (progress.type) {
      case "loading-task":
        if (progress.phase === "begin") {
          output.debug(`[Step ${progress.step}] Loading task...`);
        } else if (progress.phase === "end") {
          output.debug(`[Step ${progress.step}] Task loaded successfully.`);
        }
        break;
      case "executing-tool-call":
        if (progress.phase === "begin") {
          output.info(
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
            output.error(
              `[Step ${progress.step}] Tool ${progress.toolName} ✗ (${error})`,
            );
          } else {
            output.info(`[Step ${progress.step}] Tool ${progress.toolName} ✓`);
          }
        }
        break;
      case "sending-message":
        if (progress.phase === "begin") {
          output.debug(`[Step ${progress.step}] Sending messsage...`);
        } else if (progress.phase === "end") {
          output.debug(`[Step ${progress.step}] Messsage sent successfully.`);
        }
        break;
    }
  } else if (runnerState.state === "stopped") {
    output.info("Task runner stopped with result: ", runnerState.result);
    process.exit(0); // exit with code 0 to indicate success
  } else if (runnerState.state === "error") {
    output.error("Task runner failed with error: ", runnerState.error);
    throw runnerState.error; // rethrow the error to exit the process with a non-zero code
  }
}

program.parse();
