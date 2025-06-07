import { type AppType, createPochiEventSource } from "@ragdoll/server";
import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import { hc } from "hono/client";

import { TaskRunner } from "./task-runner";
import { asReadableMessage } from "./utils";

if (!process.env.POCHI_TASK_ID) {
  throw new Error("POCHI_TASK_ID is not set").toString();
}

const apiClient = hc<AppType>(getServerBaseUrl(), {
  headers: {
    Authorization: `Bearer ${process.env.POCHI_SESSION_TOKEN}`,
  },
});

const pochiEvents = createPochiEventSource(
  getServerBaseUrl(),
  process.env.POCHI_SESSION_TOKEN,
);

const taskId = Number.parseInt(process.env.POCHI_TASK_ID);
if (Number.isNaN(taskId)) {
  throw new Error("POCHI_TASK_ID is not a number").toString();
}

const cwd = process.env.POCHI_CWD;
const context = cwd ? { cwd } : undefined;
const runner = new TaskRunner(apiClient, pochiEvents, taskId, context);

for await (const progress of runner.start()) {
  console.log(asReadableMessage(progress));
}

process.exit(0);
