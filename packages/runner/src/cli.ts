#! /usr/bin/env bun

import { type AppType, createPochiEventSource } from "@ragdoll/server";
import { hc } from "hono/client";

import { Command } from "@commander-js/extra-typings";
import { getLogger } from "@ragdoll/common";
import { credentialStorage } from "@ragdoll/common/node";
import * as commander from "commander";
import packageJson from "../package.json";
import { findRipgrep } from "./lib/find-ripgrep";
import { TaskRunner } from "./task-runner";
import { TaskRunnerSupervisor } from "./task-runner-supervisor";

const program = new Command();
program
  .name("pochi")
  .description("Pochi Code")
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
  .option(
    "--token <token>",
    "Pochi session token",
    process.env.POCHI_SESSION_TOKEN,
  )
  .option(
    "--max-steps <number>",
    "Force stop the runner after max steps reached",
  )
  .action(async (prompt, options) => {
    if (!options.task && !prompt) {
      throw new commander.InvalidArgumentError(
        "Error: Either --task or a prompt must be provided",
      );
    }

    let token: string | undefined = options.token;
    if (!token) {
      token = await credentialStorage.read();
    }

    if (!token) {
      throw new Error(
        "Pochi session token is required. Please provide it by using --token or set POCHI_SESSION_TOKEN environment variable or login to Pochi VSCode extension.",
      );
    }

    const apiClient = hc<AppType>(options.url, {
      headers: {
        Authorization: `Bearer ${token}`,
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

    const pochiEvents = createPochiEventSource(uid, options.url, token);

    const maxSteps = parseIntOrUndefined(options.maxSteps);

    // Use existing task ID mode
    const runner = new TaskRunner({
      uid,
      accessToken: token,
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

function parseIntOrUndefined(str: string | undefined): number | undefined {
  if (!str) {
    return undefined;
  }
  const result = Number.parseInt(str, 10);
  return Number.isNaN(result) ? undefined : result;
}

program.parse();
