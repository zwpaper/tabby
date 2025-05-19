import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireAuth } from "../auth";
import { taskService } from "../service/task"; // Added import

// Define validation schemas
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  cwd: z.string().optional(),
});

const TaskParamsSchema = z.object({
  id: z.string(),
});

// Create a tasks router with authentication
const tasks = new Hono()
  // List tasks with pagination
  .get("/", zValidator("query", PaginationSchema), requireAuth(), async (c) => {
    const { cwd, page, limit } = c.req.valid("query");
    const user = c.get("user");

    const result = await taskService.list(user.id, page, limit, cwd);

    return c.json(result);
  })

  // Get a single task by ID
  .get(
    "/:id",
    zValidator("param", TaskParamsSchema),
    requireAuth(),
    async (c) => {
      const { id } = c.req.valid("param") || {};
      const user = c.get("user");
      const taskId = Number.parseInt(id);

      const task = await taskService.get(taskId, user.id);

      if (!task) {
        throw new HTTPException(404, { message: "Task not found" });
      }

      return c.json(task); // task already includes id
    },
  )

  // Delete a task by ID
  .delete(
    "/:id",
    zValidator("param", TaskParamsSchema),
    requireAuth(),
    async (c) => {
      const { id } = c.req.valid("param");
      const user = c.get("user");
      const taskId = Number.parseInt(id);

      const deleted = await taskService.delete(taskId, user.id);

      if (!deleted) {
        throw new HTTPException(404, { message: "Task not found" });
      }

      return c.json({ success: true });
    },
  );

export default tasks;
