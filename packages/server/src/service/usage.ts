import type { LanguageModelUsage } from "ai";
import type { HonoRequest } from "hono";
import { sql } from "kysely";
import moment from "moment";
import type { User } from "../auth";
import { db } from "../db";
import { readActiveSubscriptionLimits } from "../lib/billing";
import { AvailableModels, computeCreditCost } from "../lib/constants";
import { stripeClient } from "../lib/stripe";

const FreeCreditInDollars = 20;

export class UsageService {
  async trackUsage(
    user: User,
    modelId: string,
    usage: LanguageModelUsage,
  ): Promise<void> {
    const credit = await this.meterCreditCost(user, modelId, usage);

    // Track individual completion details
    await db
      .insertInto("chatCompletion")
      .values({
        modelId,
        userId: user.id,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        credit: credit,
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
        credit,
      })
      .onConflict((oc) =>
        oc
          .columns(["userId", "startDayOfMonth", "modelId"])
          .doUpdateSet((eb) => ({
            count: eb("monthlyUsage.count", "+", 1),
            credit: eb("monthlyUsage.credit", "+", credit),
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
      .select(["modelId", "count", "credit"])
      .where("userId", "=", user.id)
      // Compare the timestamp column directly with the Date object
      .where(sql`"startDayOfMonth"`, "=", startOfMonth)
      .execute(); // Use executeTakeFirstOrThrow() if you expect a result or want an error

    const monthlyCreditLimitResult = await db
      .selectFrom("monthlyCreditLimit")
      .select(["limit"])
      .where("userId", "=", user.id)
      .executeTakeFirst();

    const monthlyCreditLimit = monthlyCreditLimitResult?.limit;

    let spentCredit = 0;
    const usages = {
      basic: 0,
      premium: 0,
    };

    for (const x of results) {
      spentCredit += x.credit;
      const model = AvailableModels.find((m) => m.id === x.modelId);
      if (model) {
        usages[model.costType] += x.count;
      }
    }

    const isLimitReached =
      creditToDollars(spentCredit) - FreeCreditInDollars >
      // default monthly credit limit is $10
      (monthlyCreditLimit ?? 10);

    return {
      plan,
      usages,
      limits,
      credit: {
        spent: spentCredit,
        limit: monthlyCreditLimit,
        isLimitReached,
      },
    };
  }

  private async meterCreditCost(
    user: User,
    modelId: string,
    usage: LanguageModelUsage,
  ) {
    const creditCost = computeCreditCost(modelId, usage);

    if (!user.stripeCustomerId) {
      console.warn(
        "User does not have a Stripe customer ID, skipping billing event.",
      );
      return;
    }

    await stripeClient.billing.meterEvents.create({
      event_name: "credit",
      payload: {
        value: creditCost.toString(),
        stripe_customer_id: user.stripeCustomerId,
      },
    });

    return creditCost;
  }
}

function creditToDollars(credit: number): number {
  return credit / 10_000_000;
}

export const usageService = new UsageService();
