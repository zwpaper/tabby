import { createDisapproveInactiveUsersWorker } from "./disapprove-inactive-users";
import { createNotifyTaskSlackWorker } from "./notify-task-slack";
import { createPauseInactiveSandboxWorker } from "./pause-inactive-sandbox";

export function startWorkers() {
  createNotifyTaskSlackWorker();
  if (process.env.NODE_ENV === "production") {
    createPauseInactiveSandboxWorker();
    createDisapproveInactiveUsersWorker();
  }
}

export { enqueueNotifyTaskSlack } from "./notify-task-slack";
export { signalKeepAliveSandbox } from "./pause-inactive-sandbox";
