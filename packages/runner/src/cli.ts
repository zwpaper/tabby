#!/usr/bin/env bun

import { type AppType, createPochiEventSource } from "@ragdoll/server";
import { hc } from "hono/client";

import { Console } from "node:console";
import { Command } from "@commander-js/extra-typings";
import { getLogger } from "@ragdoll/common";
import { credentialStorage } from "@ragdoll/common/node";
import * as commander from "commander";
import packageJson from "../package.json";
import { findRipgrep } from "./lib/find-ripgrep";
import { TaskRunner } from "./task-runner";
import { TaskRunnerOutputStream } from "./task-runner-output";
import { TaskRunnerSupervisor } from "./task-runner-supervisor";

// Redirect all logging output to stderr, make sure stdout is clean for display messages
global.console = new Console({
  stdout: process.stderr,
  stderr: process.stderr,
});

const program = new Command();
program.name("pochi").description("Pochi Code");

const logger = getLogger("Pochi");

program
  .optionsGroup("Specify task:")
  .option(
    "--task <uid>",
    "The uid of the task to execute. Can also be provided via the POCHI_TASK_ID environment variable.",
  )
  .option(
    "-p, --prompt <prompt>",
    "Create a new task with the given prompt. You can also pipe input to use as a prompt, for example: `cat .pochi/workflows/create-pr.md | pochi-runner`",
  )
  .optionsGroup("Options:")
  .option(
    "--daemon",
    "Run in daemon mode. The runner will be restarted when the task is waiting for runner.",
  )
  .requiredOption(
    "--cwd <cwd>",
    "The current working directory.",
    process.cwd(),
  )
  .requiredOption(
    "--rg <path>",
    "The path to the ripgrep binary.",
    findRipgrep() || undefined,
  )
  .requiredOption(
    "--url <url>",
    "The Pochi server URL.",
    "https://app.getpochi.com",
  )
  .option(
    "--token <token>",
    "The Pochi session token. Can also be provided via the POCHI_SESSION_TOKEN environment variable or from the shared credentials file (`~/.pochi/credentials.json`).",
  )
  .option(
    "--max-steps <number>",
    "Force the runner to stop after the maximum number of steps is reached.",
    (input: string) => {
      if (!input) {
        return undefined;
      }
      const result = Number.parseInt(input);
      return Number.isNaN(result) ? undefined : result;
    },
  )
  .action(async (options) => {
    let uid = options.task ?? process.env.POCHI_TASK_ID;

    let prompt = options.prompt;
    if (!prompt && !process.stdin.isTTY) {
      const chunks = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const stdinPrompt = Buffer.concat(chunks).toString("utf8").trim();
      if (stdinPrompt) {
        prompt = stdinPrompt;
      }
    }

    if (uid && prompt) {
      throw new commander.InvalidArgumentError(
        "Error: Both task uid and prompt are provided. Please provide only one.",
      );
    }

    if (!uid && !prompt) {
      throw new commander.InvalidArgumentError(
        "Error: Either a task uid or a prompt must be provided",
      );
    }

    let token = options.token ?? process.env.POCHI_SESSION_TOKEN;
    if (!token) {
      token = await credentialStorage.read();
    }

    if (!token) {
      throw new commander.InvalidArgumentError(
        "Error: No token provided. Please use the --token option, set POCHI_SESSION_TOKEN, or confirm `~/.pochi/credentials.json` exists (login with the Pochi VSCode extension to obtain it).",
      );
    }

    const apiClient = hc<AppType>(options.url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!uid) {
      const validPrompt = prompt?.trim();
      if (!validPrompt) {
        throw new commander.InvalidArgumentError(
          "Error: Prompt cannot be empty to create a new task",
        );
      }

      // Create a new task
      // FIXME(zhiming): add retry and abort controller to creating task
      const response = await apiClient.api.tasks.$post({
        json: {
          prompt: validPrompt,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create task: ${error}`);
      }

      const task = await response.json();
      uid = task.uid;
    }

    logger.debug(
      `You can visit ${options.url}/tasks/${uid} to see the task progress.`,
    );

    const pochiEvents = createPochiEventSource(uid, options.url, token);

    const runner = new TaskRunner({
      uid,
      accessToken: token,
      apiClient,
      pochiEvents,
      cwd: options.cwd,
      rg: options.rg,
      maxSteps: options.maxSteps,
    });

    const output = new TaskRunnerOutputStream(process.stdout);

    const supervisor = new TaskRunnerSupervisor(runner, output, options.daemon);

    const handleShutdown = (signal: "SIGTERM" | "SIGINT") => {
      logger.debug(
        `Received ${signal}, shutting down supervisor gracefully...`,
      );
      supervisor.stop(signal);
    };

    // FIXME(zhiming): move adding signal handler to before create task
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));

    supervisor.start();
  });

const otherOptionsGroup = "Other options:";
program
  .optionsGroup(otherOptionsGroup)
  .version(packageJson.version, "-V, --version", "Print the version string.")
  .addHelpOption(
    new commander.Option("-h, --help", "Print this help message.").helpGroup(
      otherOptionsGroup,
    ),
  );

logger.debug(`${program.name()} v${program.version()}`);
program.parse();
