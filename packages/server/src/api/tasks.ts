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
  before: z.string().optional(),
  after: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const TaskParamsSchema = z.object({
  id: z.string(),
});

const CreateTaskSchema = z
  .object({
    event: z
      .object({
        type: z.string().describe("The type of event"),
        data: z.any().describe("The data of the event"),
      })
      .optional(),
  })
  .optional();

// Create a tasks router with authentication
const tasks = new Hono()
  // List tasks with pagination
  .get("/", zValidator("query", PaginationSchema), requireAuth, async (c) => {
    const { before, after, limit } = c.req.valid("query");
    const user = c.get("user");

    if (before && after) {
      throw new HTTPException(400, {
        message: "Cannot specify both before and after parameters",
      });
    }

    // Get paginated tasks
    let tasksQuery = db
      .selectFrom("task")
      .where("userId", "=", user.id)
      .select([
        "id",
        "createdAt",
        "updatedAt",
        "finishReason",
        sql<string>`messages[0]->'content'`.as("abstract"),
      ]);

    // Apply cursor pagination
    if (after) {
      tasksQuery = tasksQuery
        .where("id", ">", decodeTaskId(after))
        .orderBy("id", "asc");
    } else if (before) {
      tasksQuery = tasksQuery
        .where("id", "<", decodeTaskId(before))
        .orderBy("id", "desc");
    } else {
      tasksQuery = tasksQuery.orderBy("id", "asc");
    }

    // Apply limit
    tasksQuery = tasksQuery.limit(limit);

    // Execute query
    let tasks = await tasksQuery.execute();

    // If we used a before cursor, we need to reverse the results to maintain chronological order
    if (before) {
      tasks = tasks.reverse();
    }

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

    // Determine after and before cursor values for pagination
    let afterCursor = null;
    let beforeCursor = null;

    if (tasks.length > 0) {
      // For bidirectional pagination, we need both after and before cursors
      const firstItem = tasks[0];
      const lastItem = tasks[tasks.length - 1];

      // The after cursor points to what comes after the last item
      afterCursor = encodeTaskId(lastItem.id);

      // The before cursor points to what comes before the first item
      beforeCursor = encodeTaskId(firstItem.id);

      // Check if we're at the beginning of the collection
      const isAtStart = !after && !before;
      if (isAtStart) {
        beforeCursor = null;
      }

      // Check if we're at the end of the collection
      const hasMore = tasks.length === limit;
      if (!hasMore) {
        afterCursor = null;
      }
    }

    return c.json({
      data: transformedTasks,
      pagination: {
        totalCount,
        limit,
        after: afterCursor,
        before: beforeCursor,
      },
    });
  })

  // Create a task
  .post("/", zValidator("json", CreateTaskSchema), requireAuth, async (c) => {
    const { event } = (await c.req.valid("json")) || {};
    const user = c.get("user");
    const { id } = await db
      .insertInto("task")
      .values({
        userId: user.id,
        event,
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
      const { id } = c.req.valid("param") || {};
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
  )

  // Delete a task by ID
  .delete(
    "/:id",
    zValidator("param", TaskParamsSchema),
    requireAuth,
    async (c) => {
      const { id } = c.req.valid("param");
      const user = c.get("user");

      const numericId = decodeTaskId(id);

      // Check if the task exists and belongs to the user
      const task = await db
        .selectFrom("task")
        .where("id", "=", numericId)
        .where("userId", "=", user.id)
        .select("id")
        .executeTakeFirst();

      if (!task) {
        throw new HTTPException(404, { message: "Task not found" });
      }

      // Delete the task
      await db
        .deleteFrom("task")
        .where("id", "=", numericId)
        .where("userId", "=", user.id)
        .execute();

      return c.json({ success: true });
    },
  );

export default tasks;
