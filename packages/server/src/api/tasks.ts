import { zValidator } from "@hono/zod-validator";
import type { DBMessage, UserEvent } from "@ragdoll/common";
import { generateId } from "ai";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireAuth } from "../auth";
import { parseEventFilter } from "../lib/event-filter";
import { taskService } from "../service/task"; // Added import

// Define validation schemas
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  cwd: z.string().optional(),
  eventFilter: z
    .string()
    .optional()
    .transform((val) => parseEventFilter(val)),
});

const TaskParamsSchema = z.object({
  id: z.string(),
});

const ZodUserEvent: z.ZodType<UserEvent> = z.any();
const TaskCreateSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  event: ZodUserEvent.optional(),
});

// Create a tasks router with authentication
const tasks = new Hono()
  .post("/", zValidator("json", TaskCreateSchema), requireAuth(), async (c) => {
    const { prompt, event } = c.req.valid("json");
    const user = c.get("user");

    const message: DBMessage = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      role: "user",
      parts: [
        {
          type: "text",
          text: prompt,
        },
      ],
    };

    const taskId = await taskService.createWithMessage(user.id, message, event);

    return c.json({
      success: true,
      taskId,
    });
  })

  // List tasks with pagination
  .get("/", zValidator("query", PaginationSchema), requireAuth(), async (c) => {
    const { cwd, page, limit, eventFilter } = c.req.valid("query");
    const user = c.get("user");

    const result = await taskService.list(
      user.id,
      page,
      limit,
      cwd,
      eventFilter,
    );

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
