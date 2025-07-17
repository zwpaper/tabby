import type { LanguageModelUsage } from "ai";
import { sql } from "kysely";
import moment from "moment";
import type { User } from "../auth";
import { db } from "../db";
import { readActiveSubscription } from "../lib/billing";
import {
  AvailableModels,
  type CreditCostInput,
  computeCreditCost,
} from "../lib/constants";
import { stripeClient } from "../lib/stripe";
import { organizationService } from "./organization";

const FreeCreditInDollars = 20;

export class UsageService {
  async trackUsage(
    user: User,
    modelId: string,
    usage: LanguageModelUsage,
    creditCostInput: CreditCostInput | undefined,
  ): Promise<void> {
    // Track monthly usage count
    const now = moment.utc();
    const startDayOfMonth = now.startOf("month").toDate();
    const credit = creditCostInput
      ? await this.meterCreditCost(user, creditCostInput)
      : 0;

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

    const organization = await organizationService.readActiveOrganizationByUser(
      user.id,
    );

    // If an org subscription exists, only track the organization's usage.
    if (organization) {
      await db
        .insertInto("monthlyOrganizationUsage")
        .values({
          organizationId: organization.id,
          userId: user.id,
          modelId,
          startDayOfMonth,
          count: 1,
          credit,
        })
        .onConflict((oc) =>
          oc
            .columns(["organizationId", "userId", "startDayOfMonth", "modelId"])
            .doUpdateSet((eb) => ({
              count: eb("monthlyOrganizationUsage.count", "+", 1),
              credit: eb("monthlyOrganizationUsage.credit", "+", credit),
            })),
        )
        .execute();
      return;
    }

    // Otherwise, track user usage
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

  async readCurrentMonthOrganizationQuota(organizationId: string) {
    const now = moment.utc();
    const startOfMonth = now.startOf("month").toDate();

    const activeSubscription = await db
      .selectFrom("subscription")
      .select(["id", "plan"])
      .where("referenceId", "=", organizationId)
      .where("status", "=", "active")
      .executeTakeFirst();

    const usageResults = await db
      .selectFrom("monthlyOrganizationUsage")
      .select(["credit"])
      .where("organizationId", "=", organizationId)
      .where(sql`"startDayOfMonth"`, "=", startOfMonth)
      .execute();

    let spentCredit = 0;
    for (const x of usageResults) {
      spentCredit += x.credit;
    }

    const monthlyOrganizationCreditLimit =
      await this.readMonthlyOrganizationLimit(organizationId);

    const isLimitReached =
      !activeSubscription ||
      // default monthly credit limit is $10
      creditToDollars(spentCredit) > (monthlyOrganizationCreditLimit ?? 10);

    return {
      // Used to determine if there is a subscription.
      plan: activeSubscription?.plan,
      credit: {
        spent: spentCredit,
        limit: monthlyOrganizationCreditLimit,
        isLimitReached,
      },
    };
  }

  async readCurrentMonthUsage(userId: string): Promise<{
    userId: string;
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

    return {
      userId,
      premiumUsageDetails: userMonthlyPremiumUsageDetails.map((usage) => ({
        modelId: usage.modelId,
        count: Number(usage.totalCount),
      })),
    };
  }

  async readCurrentMonthQuota(user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string;
  }) {
    // Calculate the start of the current month (UTC)
    const now = moment.utc();
    const startOfMonth = now.startOf("month").toDate();

    const { plan } = await readActiveSubscription(user);

    // Query the total usage count for the current month.
    // Ensure the timestamp comparison works correctly with the database timezone (assuming UTC)
    const results = await db
      .selectFrom("monthlyUsage")
      .select(["modelId", "count", "credit"])
      .where("userId", "=", user.id)
      // Compare the timestamp column directly with the Date object
      .where(sql`"startDayOfMonth"`, "=", startOfMonth)
      .execute(); // Use executeTakeFirstOrThrow() if you expect a result or want an error

    const monthlyUserCreditLimit = await this.readMonthlyUserLimit(user.id);

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

    const remainingFreeCredit = Math.max(
      FreeCreditInDollars - creditToDollars(spentCredit),
      0,
    );

    const isLimitReached =
      creditToDollars(spentCredit) - FreeCreditInDollars >
      // default monthly credit limit is $10
      (monthlyUserCreditLimit ?? 10);

    return {
      plan,
      usages,
      credit: {
        spent: spentCredit,
        limit: monthlyUserCreditLimit,
        isLimitReached,
        remainingFreeCredit,
      },
    };
  }

  private async meterCreditCost(user: User, creditCostInput: CreditCostInput) {
    const creditCost = computeCreditCost(creditCostInput);

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

  async readMonthlyOrganizationLimit(organizationId: string) {
    const monthlyCreditLimitResult = await db
      .selectFrom("monthlyOrganizationCreditLimit")
      .select(["limit"])
      .where("organizationId", "=", organizationId)
      .executeTakeFirst();

    return monthlyCreditLimitResult?.limit;
  }

  async readMonthlyUserLimit(userId: string) {
    const monthlyCreditLimitResult = await db
      .selectFrom("monthlyCreditLimit")
      .select(["limit"])
      .where("userId", "=", userId)
      .executeTakeFirst();

    return monthlyCreditLimitResult?.limit;
  }
}

function creditToDollars(credit: number): number {
  return credit / 10_000_000;
}

export const usageService = new UsageService();
