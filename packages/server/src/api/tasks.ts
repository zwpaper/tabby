import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sql } from "kysely";
import { z } from "zod";
import { requireAuth } from "../auth";
import { db } from "../db";
import type { TaskStatus } from "../db/schema";
import { decodeTaskId, encodeTaskId } from "../lib/task-id";

// Define validation schemas
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1), // Changed from before/after to page
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
    const { page, limit } = c.req.valid("query"); // Use page and limit
    const user = c.get("user");

    const offset = (page - 1) * limit; // Calculate offset

    // Get total count first
    const totalCountResult = await db
      .selectFrom("task")
      .where("userId", "=", user.id)
      .select(db.fn.count("id").as("count"))
      .executeTakeFirst();

    const totalCount = Number(totalCountResult?.count ?? 0);
    const totalPages = Math.ceil(totalCount / limit);

    // Fetch items for the current page
    const items = await db
      .selectFrom("task")
      .where("userId", "=", user.id)
      .select([
        "id",
        "createdAt",
        "updatedAt",
        "status",
        sql<string>`messages[0]->'content'`.as("abstract"),
      ])
      .orderBy("id", "desc") // Order by newest first
      .limit(limit)
      .offset(offset) // Apply offset
      .execute();

    const data = items.map((task) => ({
      ...task,
      abstract: task.abstract?.split("\n")[0].slice(0, 64) || "(empty)",
      id: encodeTaskId(task.id),
      status: task.status as TaskStatus,
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
        .select(["id", "createdAt", "updatedAt", "status", "messages"])
        .executeTakeFirst();

      if (!task) {
        throw new HTTPException(404, { message: "Task not found" });
      }

      // Transform the response to include the encoded ID
      return c.json({
        ...task,
        id,
        status: task.status as TaskStatus,
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
