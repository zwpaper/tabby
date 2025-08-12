#!/usr/bin/env bun
// Workaround for https://github.com/oven-sh/bun/issues/18145
import "@livestore/wa-sqlite/dist/wa-sqlite.node.wasm" with { type: "file" };

import { Console } from "node:console";
import { Command } from "@commander-js/extra-typings";
import { getLogger } from "@ragdoll/common";
import { CredentialStorage } from "@ragdoll/common/node";
import type { LLMRequestData } from "@ragdoll/livekit";
import type { ChatRequest } from "@ragdoll/server";
import chalk from "chalk";
import * as commander from "commander";
import packageJson from "../package.json";
import { findRipgrep } from "./lib/find-ripgrep";
import { createStore } from "./livekit/store";
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

// const userAgent = `PochiRunner/${packageJson.version} ${`Node/${process.version}`} (${process.platform}; ${process.arch})`;

const parsePositiveInt = (input: string) => {
  if (!input) {
    return undefined;
  }
  const result = Number.parseInt(input);
  if (Number.isNaN(result) || result <= 0) {
    program.error("error: Option must be a positive integer");
  }
  return result;
};

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
    "--max-rounds <number>",
    "Force the runner to stop if the number of rounds exceeds this value.",
    parsePositiveInt,
  )
  .option(
    "--max-retries <number>",
    "Force the runner to stop if the number of retries in a single round exceeds this value.",
    parsePositiveInt,
  )
  .optionsGroup("BYOK:")
  .option("--base-url <baseURL>", "The base URL to use for BYOK requests.")
  .option("--api-key <apikey>", "The API key to use for BYOK requests.")
  .option(
    "--max-output-tokens <number>",
    "The max output tokens to use for BYOK model.",
    parsePositiveInt,
  )
  .option(
    "--context-window <number>",
    "The context window limit for BYOK model.",
    parsePositiveInt,
  )
  .action(async (options) => {
    const uid = options.task ?? process.env.POCHI_TASK_ID;

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

    let openAIModelOverride: ChatRequest["openAIModelOverride"] | undefined;
    if (options.baseUrl) {
      if (options.maxOutputTokens && options.model && options.contextWindow) {
        openAIModelOverride = {
          apiKey: options.apiKey,
          baseURL: options.baseUrl,
          maxOutputTokens: options.maxOutputTokens,
          contextWindow: options.contextWindow,
        };
      } else {
        return program.error(
          "error: --base-url requires --max-output-tokens, --model and --context-window to be set.",
        );
      }
    }

    const output = new TaskRunnerOutputStream(process.stdout);
    let supervisor: TaskRunnerSupervisor | undefined = undefined;

    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));

    const handleShutdown = (signal: "SIGTERM" | "SIGINT") => {
      logger.debug(`Received ${signal}, shutting down gracefully...`);
      if (supervisor) {
        supervisor.stop(signal);
        // process.exit will be handled by the supervisor
      } else {
        output.finish();
        process.exit(signal === "SIGINT" ? 130 : 143);
      }
    };

    const store = await createStore(options.cwd);
    if (prompt !== undefined) {
      // Create a new task with the provided prompt
      const validPrompt = prompt?.trim();
      if (!validPrompt) {
        return program.error(
          "error: Prompt cannot be empty to create a new task",
        );
      }
    }

    const llm = (
      openAIModelOverride
        ? {
            type: "openai",
            modelId: options.model || "<default>",
            baseURL: openAIModelOverride.baseURL,
            apiKey: openAIModelOverride.apiKey,
            contextWindow: openAIModelOverride.contextWindow,
            maxOutputTokens: openAIModelOverride.maxOutputTokens,
          }
        : {
            type: "pochi",
            modelId: options.model,
            modelEndpointId: options.modelEndpointId,
            server: options.url,
            token,
          }
    ) satisfies LLMRequestData;

    const runner = new TaskRunner({
      uid: uid || crypto.randomUUID(),
      store,
      llm,
      prompt,
      cwd: options.cwd,
      rg: options.rg,
      maxRounds: options.maxRounds,
      maxRetries: options.maxRetries,
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
