import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sql } from "kysely";
import { z } from "zod";
import { requireAuth } from "../auth";
import { type UserEvent, db } from "../db";

// Define validation schemas
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1), // Changed from before/after to page
  limit: z.coerce.number().int().min(1).max(100).default(10),
  cwd: z.string().optional(),
});

const TaskParamsSchema = z.object({
  id: z.string(),
});

const titleSelect =
  sql<string>`LEFT(SPLIT_PART((conversation #>> '{messages, 0, parts, 0, text}')::text, '\n', 1), 256)`.as(
    "title",
  );

// Create a tasks router with authentication
const tasks = new Hono()
  // List tasks with pagination
  .get("/", zValidator("query", PaginationSchema), requireAuth(), async (c) => {
    const { cwd, page, limit } = c.req.valid("query"); // Use page and limit
    const user = c.get("user");

    const offset = (page - 1) * limit; // Calculate offset

    // Get total count first
    let totalCountQuery = db
      .selectFrom("task")
      .where("userId", "=", user.id)
      .select(db.fn.count("id").as("count"));

    if (cwd) {
      totalCountQuery = totalCountQuery.where(
        sql`environment->'info'->'cwd'`,
        "@>",
        `"${cwd}"`,
      );
    }
    const totalCountResult = await totalCountQuery.executeTakeFirst();

    const totalCount = Number(totalCountResult?.count ?? 0);
    const totalPages = Math.ceil(totalCount / limit);

    // Fetch items for the current page
    let query = db
      .selectFrom("task")
      .where("userId", "=", user.id)
      .select([
        "taskId",
        "createdAt",
        "updatedAt",
        "status",
        sql<UserEvent["type"] | null>`event -> 'type'`.as("eventType"),
        titleSelect,
      ])
      .orderBy("taskId", "desc") // Order by newest first
      .limit(limit)
      .offset(offset);

    if (cwd) {
      query = query.where(sql`environment->'info'->'cwd'`, "@>", `"${cwd}"`);
    }

    const items = await query.execute();
    const data = items.map((task) => ({
      ...task,
      taskId: undefined,
      title: task.title || "(empty)",
      id: task.taskId,
      status: task.status,
    }));

    return c.json({
      data,
      pagination: {
        totalCount,
        limit,
        currentPage: page, // Return current page
        totalPages, // Return total pages
      },
    });
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

      const task = await db
        .selectFrom("task")
        .where("taskId", "=", taskId)
        .where("userId", "=", user.id)
        .select([
          "createdAt",
          "updatedAt",
          "status",
          "conversation",
          titleSelect,
        ])
        .executeTakeFirst();

      if (!task) {
        throw new HTTPException(404, { message: "Task not found" });
      }

      return c.json({
        ...task,
        id: taskId,
      });
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

      // Check if the task exists and belongs to the user
      const task = await db
        .selectFrom("task")
        .where("taskId", "=", Number.parseInt(id))
        .where("userId", "=", user.id)
        .executeTakeFirst();

      if (task === undefined) {
        throw new HTTPException(404, { message: "Task not found" });
      }

      // Delete the task
      await db
        .deleteFrom("task")
        .where("taskId", "=", Number.parseInt(id))
        .where("userId", "=", user.id)
        .execute();

      return c.json({ success: true });
    },
  );

export default tasks;
