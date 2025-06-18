import {
  createDisapproveInactiveUsersWorker,
  queue as disapproveInactiveUsersQueue,
} from "./disapprove-inactive-users";
import {
  createNotifyTaskSlackWorker,
  queue as slackQueue,
} from "./notify-task-slack";
import {
  createPauseInactiveSandboxWorker,
  queue as pauseInactiveSandboxQueue,
} from "./pause-inactive-sandbox";

export function startWorkers() {
  createNotifyTaskSlackWorker();
  if (process.env.NODE_ENV === "production") {
    createPauseInactiveSandboxWorker();
    createDisapproveInactiveUsersWorker();
  }
}

export { enqueueNotifyTaskSlack } from "./notify-task-slack";
export { signalKeepAliveSandbox } from "./pause-inactive-sandbox";

export const backgroundJobQueues = [
  {
    queue: slackQueue,
    displayName: "NotifySlack",
    type: "bullmq" as const,
  },
  {
    queue: disapproveInactiveUsersQueue,
    displayName: "DisapproveInactiveUsers",
    type: "bullmq" as const,
  },
  {
    queue: pauseInactiveSandboxQueue,
    displayName: "PauseInactiveSandbox",
    type: "bullmq" as const,
  },
];
