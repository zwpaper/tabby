import { type AppType, createPochiEventSource } from "@ragdoll/server";
import { Command } from "commander";
import { hc } from "hono/client";

import { asReadableMessage } from ".";
import { findRipgrep } from "./lib/find-ripgrep";
import { TaskRunner } from "./task-runner";

const program = new Command();

program.name("pochi-runner").description("Pochi cli runner");

program
  .argument("[prompt]", "Direct prompt to execute")
  .action(async (prompt) => {
    // Check if we have a POCHI_TASK_ID environment variable
    const taskId = process.env.POCHI_TASK_ID;

    if (!taskId && !prompt) {
      console.error(
        "Error: Either POCHI_TASK_ID environment variable must be set or a prompt must be provided",
      );
      process.exit(1);
    }

    const PochiServerUrl =
      process.env.POCHI_SERVER_URL || "https://app.getpochi.com";

    if (!process.env.POCHI_SESSION_TOKEN) {
      console.error(
        "Error: POCHI_SESSION_TOKEN environment variable is required",
      );
      process.exit(1);
    }

    const apiClient = hc<AppType>(PochiServerUrl, {
      headers: {
        Authorization: `Bearer ${process.env.POCHI_SESSION_TOKEN}`,
      },
    });

    const pochiEvents = createPochiEventSource(
      PochiServerUrl,
      process.env.POCHI_SESSION_TOKEN,
    );

    const cwd = process.env.POCHI_CWD || process.cwd();
    let rgPath = process.env.RIPGREP_PATH;

    // If RIPGREP_PATH is not set, try to find ripgrep in system PATH
    if (!rgPath) {
      const foundRgPath = findRipgrep();
      if (!foundRgPath) {
        throw new Error(
          "Ripgrep (rg) not found. Please install ripgrep or set RIPGREP_PATH environment variable",
        );
      }
      rgPath = foundRgPath;
    }

    if (prompt) {
      const response = await apiClient.api.tasks.$post({
        json: {
          prompt,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`Failed to create task: ${error}`);
        process.exit(1);
      }

      const task = await response.json();
      const runner = new TaskRunner(apiClient, pochiEvents, task.uid, {
        cwd,
        rgPath,
      });

      for await (const progress of runner.start()) {
        console.log(asReadableMessage(progress));
      }
    } else if (taskId) {
      // Use existing task ID mode
      const runner = new TaskRunner(apiClient, pochiEvents, taskId, {
        cwd,
        rgPath,
      });

      for await (const progress of runner.start()) {
        console.log(asReadableMessage(progress));
      }
    }

    process.exit(0);
  });

program.parse();
