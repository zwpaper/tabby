import { TaskRunner } from "./task-runner";

if (!process.env.POCHI_TASK_ID) {
  throw new Error("POCHI_TASK_ID is not set").toString();
}

const taskId = Number.parseInt(process.env.POCHI_TASK_ID);
if (Number.isNaN(taskId)) {
  throw new Error("POCHI_TASK_ID is not a number").toString();
}

const runner = new TaskRunner(taskId);

runner.start();
