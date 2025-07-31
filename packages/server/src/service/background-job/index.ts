import {
  queue as cleanupSandboxQueue,
  createCleanupSandboxWorker,
} from "./cleanup-expired-sandbox";
import {
  queue as createSandboxQueue,
  createSandboxWorker,
} from "./create-sandbox";

import {
  createNotifyTaskSlackWorker,
  queue as slackQueue,
} from "./notify-task-slack";

import {
  createMonitorStripeCreditUsageWorker,
  queue as monitorStripeCreditUsageQueue,
} from "./monitor-stripe-credit-usage";

export function startWorkers() {
  createNotifyTaskSlackWorker();
  createSandboxWorker();
  if (process.env.NODE_ENV === "production") {
    createCleanupSandboxWorker();
  }
  createMonitorStripeCreditUsageWorker();
}

export { enqueueNotifyTaskSlack } from "./notify-task-slack";

export { scheduleCleanupExpiredSandbox } from "./cleanup-expired-sandbox";
export { scheduleCreateSandbox } from "./create-sandbox";

export const backgroundJobQueues = [
  {
    queue: slackQueue,
    displayName: "NotifySlack",
    type: "bullmq" as const,
  },

  {
    queue: cleanupSandboxQueue,
    displayName: "CleanupSandbox",
    type: "bullmq" as const,
  },
  {
    queue: createSandboxQueue,
    displayName: "CreateSandbox",
    type: "bullmq" as const,
  },
  {
    queue: monitorStripeCreditUsageQueue,
    displayName: "MonitorStripeCreditUsage",
    type: "bullmq" as const,
  },
];
