import { z } from "zod";

export const ZodTodo = z.object({
  id: z
    .string()
    .describe('The unique identifier of the task, e.g "collect-information".'),
  content: z.string().describe("The content of the task."),
  status: z
    .enum(["pending", "in-progress", "completed", "cancelled"])
    .describe("The status of the task."),
  priority: z
    .enum(["low", "medium", "high"])
    .describe("The priority of the task."),
});

export type Todo = z.infer<typeof ZodTodo>;
