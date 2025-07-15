#!/usr/bin/env bun

import { Console } from "node:console";
import { Command } from "@commander-js/extra-typings";
import { getLogger } from "@ragdoll/common";
import { CredentialStorage } from "@ragdoll/common/node";
import { type AppType, createPochiEventSource } from "@ragdoll/server";
import chalk from "chalk";
import * as commander from "commander";
import { hc } from "hono/client";
import packageJson from "../package.json";
import { toError } from "./lib/error-utils";
import { findRipgrep } from "./lib/find-ripgrep";
import { withAttempts } from "./lib/with-attempts";
import { TaskRunner } from "./task-runner";
import { TaskRunnerOutputStream } from "./task-runner-output";
import { TaskRunnerSupervisor } from "./task-runner-supervisor";

// Redirect all logging output to stderr, make sure stdout is clean for display messages
global.console = new Console({
  stdout: process.stderr,
  stderr: process.stderr,
});

const program = new Command();
program
  .name("pochi")
  .description(`${chalk.bold("Pochi Code")} v${packageJson.version}`);

const logger = getLogger("Pochi");
logger.debug(`pochi v${packageJson.version}`);

const prodServerUrl = "https://app.getpochi.com";

program
  .optionsGroup("Specify Task:")
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
  .requiredOption("--url <url>", "The Pochi server URL.", prodServerUrl)
  .option(
    "--token <token>",
    "The Pochi session token. Can also be provided via the POCHI_SESSION_TOKEN environment variable or from the shared credentials file (`~/.pochi/credentials.json`).",
  )
  .option(
    "--model <model>",
    "The model to use for the task. Options: `google/gemini-2.5-pro`, `google/gemini-2.5-flash`, `anthropic/claude-4-sonnet`",
  )
  .option("--model-endpoint-id <modelEndpointId>")
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
      return program.error(
        "error: Both task uid and prompt are provided. Please provide only one.",
      );
    }

    if (!uid && !prompt) {
      return program.error(
        "error: Either a task uid or a prompt must be provided",
      );
    }

    let token = options.token ?? process.env.POCHI_SESSION_TOKEN;
    if (!token) {
      const credentialStorage = new CredentialStorage({
        isDev: options.url !== prodServerUrl,
      });
      token = await credentialStorage.read();
    }

    if (!token) {
      return program.error(
        "error: No token provided. Please use the --token option, set POCHI_SESSION_TOKEN, or confirm `~/.pochi/credentials.json` exists (login with the Pochi VSCode extension to obtain it).",
      );
    }

    const apiClient = hc<AppType>(options.url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const output = new TaskRunnerOutputStream(process.stdout);
    let creatingTaskAbortController: AbortController | undefined = undefined;
    let supervisor: TaskRunnerSupervisor | undefined = undefined;

    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));

    const handleShutdown = (signal: "SIGTERM" | "SIGINT") => {
      logger.debug(`Received ${signal}, shutting down gracefully...`);
      creatingTaskAbortController?.abort();
      if (supervisor) {
        supervisor.stop(signal);
        // process.exit will be handled by the supervisor
      } else {
        output.finish();
        process.exit(signal === "SIGINT" ? 130 : 143);
      }
    };

    if (!uid) {
      // Create a new task with the provided prompt
      const validPrompt = prompt?.trim();
      if (!validPrompt) {
        return program.error(
          "error: Prompt cannot be empty to create a new task",
        );
      }

      output.startLoading("Creating task...");
      const abortController = new AbortController();
      creatingTaskAbortController = abortController;

      try {
        uid = await withAttempts(
          async () => {
            const response = await apiClient.api.tasks.$post(
              {
                json: {
                  prompt: validPrompt,
                },
              },
              {
                init: {
                  signal: abortController.signal,
                },
              },
            );

            if (!response.ok) {
              const error = await response.text();
              throw new Error(
                `Failed to create task: ${response.status} ${error}`,
              );
            }

            const task = await response.json();
            return task.uid;
          },
          { abortSignal: abortController.signal },
        );
      } catch (error) {
        if (abortController.signal.aborted) {
          return; // just exit if aborted
        }
        output.failLoading(chalk.bold(chalk.red("Failed to create task.")));
        output.printError(toError(error));
        output.finish();
        throw error; // rethrow to exit the process
      }

      const taskUrl = chalk.underline(`${options.url}/tasks/${uid}`);
      output.succeedLoading(
        `${chalk.bold(chalk.green("Task created:"))} ${taskUrl}.`,
      );
      output.println();
    }

    const pochiEvents = createPochiEventSource(uid, options.url, token);

    const runner = new TaskRunner({
      uid,
      accessToken: token,
      apiClient,
      pochiEvents,
      cwd: options.cwd,
      rg: options.rg,
      model: options.model,
      maxSteps: options.maxSteps,
      modelEndpointId: options.modelEndpointId,
    });

    supervisor = new TaskRunnerSupervisor(runner, output, options.daemon);
    supervisor.start();
  });

const otherOptionsGroup = "Others:";
program
  .optionsGroup(otherOptionsGroup)
  .version(packageJson.version, "-V, --version", "Print the version string.")
  .addHelpOption(
    new commander.Option("-h, --help", "Print this help message.").helpGroup(
      otherOptionsGroup,
    ),
  )
  .configureHelp({
    styleTitle: (title) => chalk.bold(title),
  })
  .showHelpAfterError()
  .showSuggestionAfterError()
  .configureOutput({
    outputError: (str, write) => write(chalk.red(str)),
  });

program.parse(process.argv);
