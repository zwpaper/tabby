import { getLogger } from "@ragdoll/common";
import type { LanguageModelUsage } from "ai";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import moment from "moment";
import type { User } from "../auth";
import { db } from "../db";
import {
  AvailableModels,
  type CreditCostInput,
  StripePlans,
  computeCreditCost,
} from "../lib/constants";
import { stripeClient } from "../lib/stripe";
import { spanConfig } from "../trace";
import { organizationService } from "./organization";

const logger = getLogger("UsageService");

const FreeCreditInDollars = 20;
const FreeCredit = FreeCreditInDollars * 10_000_000;
const CodeCompletionSubscriptionCountThreshold = 100;

export class UsageService {
  async trackUsage(
    user: User,
    modelId: string,
    usage: LanguageModelUsage,
    creditCostInput: CreditCostInput | undefined,
    remainingFreeCredit: number,
  ): Promise<void> {
    // Track monthly usage count
    const now = moment.utc();
    const startDayOfMonth = now.startOf("month").toDate();
    const credit =
      (creditCostInput &&
        (await this.meterCreditCost(
          user,
          creditCostInput,
          remainingFreeCredit,
        ))) ||
      0;

    spanConfig.setAttribute("ragdoll.metering.credit", credit);

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

    const result = await db
      .selectNoFrom([
        (eb) =>
          jsonArrayFrom(
            eb
              .selectFrom("subscription")
              .select(["id", "plan", "status"])
              .where("referenceId", "=", organizationId)
              .where("status", "in", ["active", "past_due", "unpaid"]),
          ).as("subscriptions"),
        (eb) =>
          eb
            .selectFrom("monthlyOrganizationUsage")
            .select((eb) => [eb.fn.sum<number>("credit").as("sum")])
            .where("organizationId", "=", organizationId)
            .where("startDayOfMonth", "=", startOfMonth)
            .as("spentCredit"),
        (eb) =>
          eb
            .selectFrom("monthlyOrganizationCreditLimit")
            .select("limit")
            .where("organizationId", "=", organizationId)
            .as("monthlyOrganizationCreditLimit"),
      ])
      .executeTakeFirst();

    const subscriptions = result?.subscriptions ?? [];
    const activeSubscription = subscriptions.find((x) => x.status === "active");
    const unpaidSubscription = subscriptions.find(
      (x) => x.status === "past_due" || x.status === "unpaid",
    );

    const spentCredit = result?.spentCredit ?? 0;
    const monthlyOrganizationCreditLimit =
      result?.monthlyOrganizationCreditLimit;

    const isLimitReached =
      !activeSubscription ||
      // default monthly credit limit is $10
      creditToDollars(spentCredit) > (monthlyOrganizationCreditLimit ?? 10);

    return {
      // Used to determine if there is a active subscription.
      plan: activeSubscription?.plan,
      credit: {
        spent: spentCredit,
        limit: monthlyOrganizationCreditLimit,
        isLimitReached,
        isUnpaid: !!unpaidSubscription,
      },
    };
  }

  async readCurrentMonthOrganizationQuotaByUser(userId: string) {
    const now = moment.utc();
    const startOfMonth = now.startOf("month").toDate();

    const result = await db
      .selectFrom("member")
      .innerJoin("organization", "organization.id", "member.organizationId")
      .where("member.userId", "=", userId)
      .selectAll("organization")
      .select((eb) => [
        jsonArrayFrom(
          eb
            .selectFrom("subscription")
            .select(["id", "plan", "status"])
            .whereRef("referenceId", "=", "organization.id")
            .where("status", "in", ["active", "past_due", "unpaid"]),
        ).as("subscriptions"),
        eb
          .selectFrom("monthlyOrganizationUsage")
          .select((eb) => [eb.fn.sum<number>("credit").as("sum")])
          .whereRef("organizationId", "=", "organization.id")
          .where("startDayOfMonth", "=", startOfMonth)
          .as("spentCreditResult"),
        eb
          .selectFrom("monthlyOrganizationCreditLimit")
          .select("limit")
          .whereRef("organizationId", "=", "organization.id")
          .as("monthlyOrganizationCreditLimit"),
      ])
      .executeTakeFirst();

    if (!result) {
      return null;
    }

    const {
      subscriptions,
      spentCreditResult,
      monthlyOrganizationCreditLimit,
      ...organization
    } = result;

    const subs = subscriptions ?? [];
    const activeSubscription = subs.find((x) => x.status === "active");
    const unpaidSubscription = subs.find(
      (x) => x.status === "past_due" || x.status === "unpaid",
    );

    const totalSpentCredit = spentCreditResult ?? 0;
    const limit = monthlyOrganizationCreditLimit;

    const isLimitReached =
      !activeSubscription ||
      // default monthly credit limit is $10
      creditToDollars(totalSpentCredit) > (limit ?? 10);

    const quota = {
      // Used to determine if there is a active subscription.
      plan: activeSubscription?.plan,
      credit: {
        spent: totalSpentCredit,
        limit,
        isLimitReached,
        isUnpaid: !!unpaidSubscription,
      },
    };
    return { organization, quota };
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

    const result = await db
      .selectNoFrom([
        (eb) =>
          jsonArrayFrom(
            eb
              .selectFrom("subscription")
              .select(["id", "plan", "status"])
              .where("referenceId", "=", user.id)
              .where("status", "in", ["active", "past_due", "unpaid"]),
          ).as("subscriptions"),
        (eb) =>
          jsonArrayFrom(
            eb
              .selectFrom("monthlyUsage")
              .select(["modelId", "count", "credit"])
              .where("userId", "=", user.id)
              .where("startDayOfMonth", "=", startOfMonth),
          ).as("usageResults"),
        (eb) =>
          eb
            .selectFrom("monthlyCreditLimit")
            .select("limit")
            .where("userId", "=", user.id)
            .as("monthlyUserCreditLimit"),
      ])
      .executeTakeFirst();

    const subscriptions = result?.subscriptions ?? [];
    const activeSubscription = subscriptions.find((x) => x.status === "active");
    const unpaidSubscription = subscriptions.find(
      (x) => x.status === "past_due" || x.status === "unpaid",
    );

    const planId =
      activeSubscription?.plan ?? StripePlans[0].name.toLowerCase();
    const plan = planId.charAt(0).toUpperCase() + planId.slice(1);

    const usageResults = result?.usageResults ?? [];
    let spentCredit = 0;
    const usages = {
      basic: 0,
      premium: 0,
    };

    for (const x of usageResults) {
      spentCredit += x.credit;
      const model = AvailableModels.find((m) => m.id === x.modelId);
      if (model) {
        usages[model.costType] += x.count;
      }
    }

    const monthlyUserCreditLimit = result?.monthlyUserCreditLimit;

    const remainingFreeCredit = Math.max(FreeCredit - spentCredit, 0);

    const isLimitReached =
      creditToDollars(spentCredit) - FreeCreditInDollars >
      // default monthly credit limit is $10
      (monthlyUserCreditLimit ?? 10);

    return {
      // Used to determine if there is a active subscription.
      plan,
      usages,
      credit: {
        spent: spentCredit,
        remainingFreeCredit,
        limit: monthlyUserCreditLimit, // in dollars
        isLimitReached,
        isUnpaid: !!unpaidSubscription,
      },
    };
  }

  private async meterCreditCost(
    user: User,
    creditCostInput: CreditCostInput,
    remainingFreeCredit: number,
  ) {
    const creditCost = computeCreditCost(creditCostInput);
    if (!user.stripeCustomerId) {
      logger.warn(
        "User does not have a Stripe customer ID, skipping billing event.",
      );
      return;
    }

    const creditCostForStripe = creditCost - remainingFreeCredit;
    if (creditCostForStripe > 0) {
      await stripeClient.billing.meterEvents.create({
        event_name: "credit",
        payload: {
          value: creditCostForStripe.toString(),
          stripe_customer_id: user.stripeCustomerId,
        },
      });
    }

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

  async trackCodeCompletionUsage(user: User, count = 1) {
    const now = moment.utc();
    const startDayOfMonth = now.startOf("month").toDate();

    await db
      .insertInto("monthlyCodeCompletionUsage")
      .values({
        userId: user.id,
        startDayOfMonth,
        count,
      })
      .onConflict((oc) =>
        oc.columns(["userId", "startDayOfMonth"]).doUpdateSet((eb) => ({
          count: eb("monthlyCodeCompletionUsage.count", "+", count),
        })),
      )
      .execute();
  }

  async readCodeCompletionUsage(user: User) {
    const now = moment.utc();
    const startDayOfMonth = now.startOf("month").toDate();

    const result = await db
      .selectNoFrom([
        (eb) =>
          eb
            .selectFrom("monthlyCodeCompletionUsage")
            .select("count")
            .where("userId", "=", user.id)
            .where("startDayOfMonth", "=", startDayOfMonth)
            .as("usageCount"),
        (eb) =>
          jsonArrayFrom(
            eb
              .selectFrom("subscription")
              .select(["id", "plan", "status"])
              .where("referenceId", "=", user.id)
              .where("status", "in", ["active", "past_due", "unpaid"]),
          ).as("subscriptions"),
      ])
      .executeTakeFirst();

    const count = result?.usageCount ?? 0;
    const subscriptions = result?.subscriptions ?? [];
    const activeSubscription = subscriptions.find((x) => x.status === "active");
    const unpaidSubscription = subscriptions.find(
      (x) => x.status === "past_due" || x.status === "unpaid",
    );

    const plan = activeSubscription?.plan ?? "Community";

    return {
      count,
      isSubscriptionRequired: count >= CodeCompletionSubscriptionCountThreshold,
      isUnpaid: !!unpaidSubscription,
      plan,
    };
  }
}

function creditToDollars(credit: number): number {
  return credit / 10_000_000;
}

export const usageService = new UsageService();
