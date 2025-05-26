import type { apiClient } from "@/lib/auth-client";
import type { InferResponseType } from "hono/client";
import { z } from "zod";

export const taskSchema: z.ZodType<Task> = z.any();

type TasksResponse = InferResponseType<typeof apiClient.api.tasks.$get>;
export type Task = TasksResponse["data"][number];
export type TaskStatus = Task["status"];
