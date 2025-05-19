import type { LanguageModelUsage } from "ai";
import type { HonoRequest } from "hono";
import { sql } from "kysely";
import moment from "moment";
import type { User } from "../auth";
import { db } from "../db";
import { readActiveSubscriptionLimits } from "../lib/billing";
import { AvailableModels } from "../lib/constants";

export class UsageService {
  async trackUsage(
    user: User,
    modelId: string,
    usage: LanguageModelUsage,
  ): Promise<void> {
    // Track individual completion details
    await db
      .insertInto("chatCompletion")
      .values({
        modelId,
        userId: user.id,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
      })
      .execute();

    // Track monthly usage count
    const now = moment.utc();
    const startDayOfMonth = now.startOf("month").toDate();

    await db
      .insertInto("monthlyUsage")
      .values({
        userId: user.id,
        modelId,
        startDayOfMonth,
        count: 1, // Start count at 1 for a new entry
      })
      .onConflict((oc) =>
        oc
          .columns(["userId", "startDayOfMonth", "modelId"])
          .doUpdateSet((eb) => ({
            count: eb("monthlyUsage.count", "+", 1),
          })),
      )
      .execute();
  }

  async readCurrentMonthUsage(
    userId: string,
    targetUser: User,
    req: HonoRequest,
  ): Promise<{
    userId: string;
    limit: number;
    premiumUsageDetails: {
      modelId: string;
      count: number;
    }[];
  }> {
    const now = moment.utc(); // Use UTC for current time
    const startOfMonth = now.clone().startOf("month").toDate(); // Clone before mutation
    const endOfMonth = now.clone().endOf("month").toDate(); // Clone before mutation

    const premiumModelIds = AvailableModels.filter(
      (m) => m.costType === "premium",
    ).map((m) => m.id);

    const userMonthlyPremiumUsageDetails = await db
      .selectFrom("monthlyUsage")
      .select(["modelId", db.fn.sum("count").as("totalCount")])
      .where("userId", "=", userId)
      .where("startDayOfMonth", ">=", startOfMonth)
      .where("startDayOfMonth", "<=", endOfMonth)
      .where("modelId", "in", premiumModelIds)
      .groupBy("modelId")
      .execute();

    const { limits: userLimits } = await readActiveSubscriptionLimits(
      targetUser,
      req,
    );

    return {
      userId,
      limit: userLimits.premium,
      premiumUsageDetails: userMonthlyPremiumUsageDetails.map((usage) => ({
        modelId: usage.modelId,
        count: Number(usage.totalCount),
      })),
    };
  }

  async readCurrentMonthQuota(user: User, r: HonoRequest) {
    // Calculate the start of the current month (UTC)
    const now = moment.utc();
    const startOfMonth = now.startOf("month").toDate();

    const { plan, limits } = await readActiveSubscriptionLimits(user, r);

    // Query the total usage count for the current month.
    // Ensure the timestamp comparison works correctly with the database timezone (assuming UTC)
    const results = await db
      .selectFrom("monthlyUsage")
      .select(["modelId", "count"])
      .where("userId", "=", user.id)
      // Compare the timestamp column directly with the Date object
      .where(sql`"startDayOfMonth"`, "=", startOfMonth)
      .execute(); // Use executeTakeFirstOrThrow() if you expect a result or want an error

    const usages = {
      basic: 0,
      premium: 0,
    };

    for (const x of results) {
      const model = AvailableModels.find((m) => m.id === x.modelId);
      if (model) {
        usages[model.costType] += x.count;
      }
    }

    return {
      plan,
      usages,
      limits,
    };
  }
}

export const usageService = new UsageService();
