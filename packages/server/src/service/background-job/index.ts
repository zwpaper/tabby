import { createDisapproveInactiveUsersWorker } from "./disapprove-inactive-users";
import { createNotifyTaskSlackWorker } from "./notify-task-slack";

export function startWorkers() {
  createNotifyTaskSlackWorker();
  if (process.env.NODE_ENV === "production") {
    createDisapproveInactiveUsersWorker();
  }
}

export { enqueueNotifyTaskSlack } from "./notify-task-slack";
