import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { sql } from "kysely";
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

const usages = new Hono().get(
  "/chat",
  requireAuth,
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

    // Query to get daily breakdowns, adjusting for user's timezone
    const dailyResults = await db
      .selectFrom("chatCompletion")
      .select([
        sql<Date>`DATE("createdAt" AT TIME ZONE ${tz})`.as("date"),
        "modelId",
        db.fn.count("id").as("count"),
      ])
      .where("userId", "=", user.id)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate)
      .groupBy(["date", "modelId"])
      .orderBy("date")
      .execute();

    return c.json({
      summary: {
        promptTokens: Number(aggregateResult?.totalPromptTokens || 0),
        completionTokens: Number(aggregateResult?.totalCompletionTokens || 0),
        completionCount: Number(aggregateResult?.completionCount || 0),
        totalTokens:
          Number(aggregateResult?.totalPromptTokens || 0) +
          Number(aggregateResult?.totalCompletionTokens || 0),
      },
      daily: dailyResults.map((day) => ({
        date: moment(day.date).utcOffset(tz).format("YYYY-MM-DD"),
        modelId: day.modelId,
        completionCount: Number(day.count || 0),
      })),
    });
  },
);

export default usages;
