import type { Task } from "../tasks/types";

export interface BatchStatus {
  batchId: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  status: "running" | "completed" | "failed";
  tasks: Task[];
  createdAt: string;
  githubTemplateUrl?: string;
}
