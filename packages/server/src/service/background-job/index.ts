import { createDisapproveInactiveUsersWorker } from "./disapprove-inactive-users";
import { createNotifyTaskSlackWorker } from "./notify-task-slack";
import { createPauseInactiveSandboxWorker } from "./pause-inactive-sandbox";

export function startWorkers() {
  createNotifyTaskSlackWorker();
  createPauseInactiveSandboxWorker();
  if (process.env.NODE_ENV === "production") {
    createDisapproveInactiveUsersWorker();
  }
}

export { enqueueNotifyTaskSlack } from "./notify-task-slack";
export { signalKeepAliveSandbox } from "./pause-inactive-sandbox";
