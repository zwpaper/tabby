import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import moment from "moment";
import { z } from "zod";
import { requireAuth } from "../auth";
import { db } from "../db";
import "moment-timezone";

// Define the schema for query parameters
const UsageQuerySchema = z.object({
  start: z.string().optional(), // start date in ISO format (YYYY-MM-DD)
  end: z.string().optional(), // end date in ISO format (YYYY-MM-DD)
  tz: z.string().optional(), // timezone offset in minutes
});

const usages = new Hono()
  .get(
    "/chat",
    requireAuth(),
    zValidator("query", UsageQuerySchema),
    async (c) => {
      const user = c.get("user");
      const { start, end, tz = "UTC" } = c.req.valid("query");

      // Default to last 30 days if no date range is provided
      const endDate = end
        ? moment.tz(end, tz).add(1, "day").subtract(1, "second").toDate()
        : new Date();
      const startDate = start
        ? moment.tz(start, tz).toDate()
        : moment.tz(endDate, tz).subtract(30, "days").toDate();

      // Query to get aggregate tasks data.
      const aggregateTaskResult = await db
        .selectFrom("task")
        .select([db.fn.count("id").as("taskCount")])
        .where("userId", "=", user.id)
        .where("createdAt", ">=", startDate)
        .where("createdAt", "<=", endDate)
        .executeTakeFirst();

      // Query to get aggregate data across the date range
      const aggregateResult = await db
        .selectFrom("chatCompletion")
        .select([
          db.fn.sum("promptTokens").as("totalPromptTokens"),
          db.fn.sum("completionTokens").as("totalCompletionTokens"),
          db.fn.count("id").as("completionCount"),
        ])
        .where("userId", "=", user.id)
        .where("createdAt", ">=", startDate)
        .where("createdAt", "<=", endDate)
        .executeTakeFirst();

      return c.json({
        summary: {
          promptTokens: Number(aggregateResult?.totalPromptTokens || 0),
          completionTokens: Number(aggregateResult?.totalCompletionTokens || 0),
          completionCount: Number(aggregateResult?.completionCount || 0),
          totalTokens:
            Number(aggregateResult?.totalPromptTokens || 0) +
            Number(aggregateResult?.totalCompletionTokens || 0),
          taskCount: Number(aggregateTaskResult?.taskCount || 0),
        },
      });
    },
  )
  .get(
    "/organization/:orgId/chat",
    requireAuth(),
    zValidator("query", UsageQuerySchema),
    async (c) => {
      const user = c.get("user");
      const orgId = c.req.param("orgId");

      // Permission check
      const member = await db
        .selectFrom("member")
        .select("id")
        .where("userId", "=", user.id)
        .where("organizationId", "=", orgId)
        .executeTakeFirst();

      if (!member) {
        return c.json({ error: "Unauthorized" }, 403);
      }

      const { start, end, tz = "UTC" } = c.req.valid("query");

      const endDate = end
        ? moment.tz(end, tz).add(1, "day").subtract(1, "second").toDate()
        : new Date();
      const startDate = start
        ? moment.tz(start, tz).toDate()
        : moment.tz(endDate, tz).subtract(30, "days").toDate();

      // Get all members for organization
      const members = await db
        .selectFrom("member")
        .innerJoin("user", "user.id", "member.userId")
        .select(["user.id", "user.name", "user.email", "user.image"])
        .where("organizationId", "=", orgId)
        .execute();

      const memberIds = members.map((m) => m.id);

      // Organization-level summary - count completions for all member users
      const orgAggregateResult = await db
        .selectFrom("chatCompletion")
        .select([db.fn.count("id").as("completionCount")])
        .where("userId", "in", memberIds)
        .where("createdAt", ">=", startDate)
        .where("createdAt", "<=", endDate)
        .executeTakeFirst();

      const orgTaskResult = await db
        .selectFrom("task")
        .innerJoin("member", "member.userId", "task.userId")
        .select([db.fn.count("task.id").as("taskCount")])
        .where("member.organizationId", "=", orgId)
        .where("task.createdAt", ">=", startDate)
        .where("task.createdAt", "<=", endDate)
        .executeTakeFirst();

      const combinedUserData = new Map<
        string,
        {
          userId: string;
          name: string | null;
          email: string;
          image: string | null;
          completionCount: number;
          taskCount: number;
        }
      >();
      for (const member of members) {
        combinedUserData.set(member.id, {
          userId: member.id,
          name: member.name,
          email: member.email,
          image: member.image,
          completionCount: 0,
          taskCount: 0,
        });
      }

      // User-level completion breakdown for organization members
      const userCompletionBreakdown = await db
        .selectFrom("chatCompletion")
        .select(["userId", db.fn.count("id").as("completionCount")])
        .where("userId", "in", memberIds)
        .where("createdAt", ">=", startDate)
        .where("createdAt", "<=", endDate)
        .groupBy("userId")
        .execute();

      for (const u of userCompletionBreakdown) {
        const existing = combinedUserData.get(u.userId);
        if (existing) {
          existing.completionCount = Number(u.completionCount || 0);
        }
      }

      // User-level task breakdown
      const userTaskBreakdown = await db
        .selectFrom("task")
        .innerJoin("member", "member.userId", "task.userId")
        .select(["task.userId", db.fn.count("task.id").as("taskCount")])
        .where("member.organizationId", "=", orgId)
        .where("task.createdAt", ">=", startDate)
        .where("task.createdAt", "<=", endDate)
        .groupBy("task.userId")
        .execute();

      for (const t of userTaskBreakdown) {
        const existing = combinedUserData.get(t.userId);
        if (existing) {
          existing.taskCount = Number(t.taskCount || 0);
        }
      }

      const activeUsersData = Array.from(combinedUserData.values())
        .filter((u) => u.completionCount > 0 || u.taskCount > 0)
        .sort((a, b) => b.taskCount - a.taskCount);

      return c.json({
        summary: {
          completionCount: Number(orgAggregateResult?.completionCount || 0),
          taskCount: Number(orgTaskResult?.taskCount || 0),
          activeUsers: activeUsersData.length,
        },
        users: activeUsersData,
      });
    },
  );

export default usages;
