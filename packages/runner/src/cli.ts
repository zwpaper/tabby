import { type AppType, createPochiEventSource } from "@ragdoll/server";
import { hc } from "hono/client";

import { asReadableMessage } from ".";
import { findRipgrep } from "./lib/find-ripgrep";
import { TaskRunner } from "./task-runner";

if (!process.env.POCHI_TASK_ID) {
  throw new Error("POCHI_TASK_ID is not set").toString();
}

const PochiServerUrl =
  process.env.POCHI_SERVER_URL || "https://app.getpochi.com";

const apiClient = hc<AppType>(PochiServerUrl, {
  headers: {
    Authorization: `Bearer ${process.env.POCHI_SESSION_TOKEN}`,
  },
});

const pochiEvents = createPochiEventSource(
  PochiServerUrl,
  process.env.POCHI_SESSION_TOKEN,
);

const taskId = Number.parseInt(process.env.POCHI_TASK_ID);
if (Number.isNaN(taskId)) {
  throw new Error("POCHI_TASK_ID is not a number");
}

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
const runner = new TaskRunner(apiClient, pochiEvents, taskId, { cwd, rgPath });

for await (const progress of runner.start()) {
  console.log(asReadableMessage(progress));
}

process.exit(0);
