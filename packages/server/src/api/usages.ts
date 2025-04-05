import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAuth } from "../auth";
import { db } from "../db";

// Define the schema for query parameters
const UsageQuerySchema = z.object({
  start: z.string().optional(), // start date in ISO format (YYYY-MM-DD)
  end: z.string().optional(),   // end date in ISO format (YYYY-MM-DD)
});

const usages = new Hono()
  .get("/chat", requireAuth, zValidator("query", UsageQuerySchema), async (c) => {
    const user = c.get("user");
    const { start, end } = c.req.valid("query");
    
    // Default to last 30 days if no date range is provided
    const endDate = end ? new Date(end) : new Date();
    const startDate = start ? new Date(start) : new Date(endDate);
    
    // If no start date provided, default to 30 days before end date
    if (!start) {
      startDate.setDate(endDate.getDate() - 30);
    }
    
    // Query to get aggregate data across the date range
    const aggregateResult = await db
      .selectFrom("chatCompletion")
      .select([
        db.fn.sum("promptTokens").as("totalPromptTokens"),
        db.fn.sum("completionTokens").as("totalCompletionTokens"),
        db.fn.count("id").as("completionCount")
      ])
      .where("userId", "=", user.id)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<", endDate)
      .executeTakeFirst();
    
    // Query to get daily breakdowns
    const dailyResults = await db
      .selectFrom("chatCompletion")
      .select([
        db.fn("date", ["createdAt"]).as("date"),
        db.fn.sum("promptTokens").as("promptTokens"),
        db.fn.sum("completionTokens").as("completionTokens"),
        db.fn.count("id").as("count")
      ])
      .where("userId", "=", user.id)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<", endDate)
      .groupBy("date")
      .orderBy("date")
      .execute();
    
    return c.json({
      range: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      },
      summary: {
        promptTokens: Number(aggregateResult?.totalPromptTokens || 0),
        completionTokens: Number(aggregateResult?.totalCompletionTokens || 0),
        completionCount: Number(aggregateResult?.completionCount || 0),
        totalTokens: Number(aggregateResult?.totalPromptTokens || 0) + Number(aggregateResult?.totalCompletionTokens || 0)
      },
      daily: dailyResults.map(day => ({
        date: day.date,
        promptTokens: Number(day.promptTokens || 0),
        completionTokens: Number(day.completionTokens || 0),
        completionCount: Number(day.count || 0),
        totalTokens: Number(day.promptTokens || 0) + Number(day.completionTokens || 0)
      }))
    });
  });

export default usages;
