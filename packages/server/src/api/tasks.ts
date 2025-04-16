import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sql } from "kysely";
import { z } from "zod";
import { requireAuth } from "../auth";
import { db } from "../db";
import { decodeTaskId, encodeTaskId } from "../lib/task-id";

// Define validation schemas
const PaginationSchema = z.object({
  after: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const TaskParamsSchema = z.object({
  id: z.string(),
});

// Create a tasks router with authentication
const tasks = new Hono()
  // List tasks with pagination
  .get("/", zValidator("query", PaginationSchema), requireAuth, async (c) => {
    const { after, limit } = c.req.valid("query");
    const user = c.get("user");

    // Get paginated tasks
    const tasksQuery = db
      .selectFrom("task")
      .where("userId", "=", user.id)
      .where("id", ">", after ? decodeTaskId(after) : 0)
      .select([
        "id",
        sql<Date>`"createdAt" AT TIME ZONE 'UTC'`.as("createdAt"),
        sql<Date>`"updatedAt" AT TIME ZONE 'UTC'`.as("updatedAt"),
        "finishReason",
        sql<string>`messages[0]->'content'`.as("abstract"),
      ])
      .limit(limit);

    const tasks = await tasksQuery.execute();

    // Get total count for pagination
    const countResult = await db
      .selectFrom("task")
      .where("userId", "=", user.id)
      .select(db.fn.count("id").as("count"))
      .executeTakeFirst();

    const totalCount = Number(countResult?.count || 0);

    // Transform the response to use encoded task IDs
    const transformedTasks = tasks.map((task) => ({
      ...task,
      abstract: task.abstract?.split("\n")[0].slice(0, 48) || "(empty)",
      id: encodeTaskId(task.id),
    }));

    return c.json({
      data: transformedTasks,
      pagination: {
        totalCount,
        limit,
        after:
          tasks.length > 0 ? encodeTaskId(tasks[tasks.length - 1].id) : null,
      },
    });
  })

  // Create a task
  .post("/", requireAuth, async (c) => {
    const user = c.get("user");
    const { id } = await db
      .insertInto("task")
      .values({
        userId: user.id,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    return c.json({ id: encodeTaskId(id) });
  })

  // Get a single task by ID
  .get(
    "/:id",
    zValidator("param", TaskParamsSchema),
    requireAuth,
    async (c) => {
      const { id } = c.req.valid("param");
      const user = c.get("user");

      const numericId = decodeTaskId(id);

      const task = await db
        .selectFrom("task")
        .where("id", "=", numericId)
        .where("userId", "=", user.id)
        .select(["id", "createdAt", "updatedAt", "finishReason", "messages"])
        .executeTakeFirst();

      if (!task) {
        throw new HTTPException(404, { message: "Task not found" });
      }

      // Transform the response to include the encoded ID
      return c.json({
        ...task,
        id,
      });
    },
  );

export default tasks;
