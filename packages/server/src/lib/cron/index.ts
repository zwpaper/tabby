import { startDisapproveInactiveUsersScheduler } from "./disapprove-inactive-user";

export function startServerCronJobs() {
  startDisapproveInactiveUsersScheduler();
}
