import { type AppType, createPochiEventSource } from "@ragdoll/server";
import { hc } from "hono/client";

import { Command } from "@commander-js/extra-typings";
import { getLogger } from "@ragdoll/common";
import * as commander from "commander";
import packageJson from "../package.json";
import { findRipgrep } from "./lib/find-ripgrep";
import { TaskRunner } from "./task-runner";
import { TaskRunnerSupervisor } from "./task-runner-supervisor";

const program = new Command();
program
  .name("pochi-runner")
  .description("Pochi cli runner")
  .version(packageJson.version, "-V, --version", "output the current version");

const logger = getLogger("Pochi");

program
  .argument("[prompt]", "Creating a new task with the given prompt")
  .option("--url <url>", "Pochi server url", "https://app.getpochi.com")
  .option("--task <uid>", "Task uid to execute", process.env.POCHI_TASK_ID)
  .option(
    "--daemon",
    "Run in daemon mode with supervisor that monitors and restarts runners",
  )
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
  .requiredOption(
    "--max-steps <number>",
    "Force stop the runner after max steps reached",
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
      `You can visit ${options.url}/tasks/${uid} to see the task progress.`,
    );

    const pochiEvents = createPochiEventSource(uid, options.url, options.token);

    const maxSteps = parseIntOrUndefined(options.maxSteps);

    // Use existing task ID mode
    const runner = new TaskRunner({
      uid,
      apiClient,
      pochiEvents,
      cwd: options.cwd,
      rg: options.rg,
      maxSteps,
    });

    const supervisor = new TaskRunnerSupervisor(runner, options.daemon);

    const handleShutdown = (signal: "SIGTERM" | "SIGINT") => {
      logger.info(`Received ${signal}, shutting down supervisor gracefully...`);
      supervisor.stop(signal);
    };

    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));

    supervisor.start();
  });

function parseIntOrUndefined(str: string): number | undefined {
  const result = Number.parseInt(str, 10);
  return Number.isNaN(result) ? undefined : result;
}

program.parse();
