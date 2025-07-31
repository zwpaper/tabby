import { getLogger } from "@ragdoll/common";
import { Queue, Worker } from "bullmq";
import { db } from "../../db";
import { stripeClient } from "../../lib/stripe";
import { organizationService } from "../organization";
import { usageService } from "../usage";
import { queueConfig } from "./redis";

const QueueName = "monitor-stripe-credit";

const logger = getLogger("MonitorStripeCredit");

const FreeCreditInDollars = 20;

interface MonitorStripeCreditJobData {
  userId: string;
  spentCreditInStripe: number;
  spentCreditInDB: number;
  subscriptionId: string;
}

// compare spent credit between Stripe and DB
async function compareSpentCredit() {
  const subscriptions = await db
    .selectFrom("subscription")
    .where("stripeSubscriptionId", "is not", null)
    .where("stripeCustomerId", "is not", null)
    .selectAll()
    .execute();

  // Group subscriptions by customerId and plan
  const groupedSubscriptions: Record<string, typeof subscriptions> = {};
  for (const subscription of subscriptions) {
    if (!subscription.stripeCustomerId || !subscription.plan) continue;

    const key = `${subscription.stripeCustomerId}-${subscription.plan}`;
    if (!groupedSubscriptions[key]) {
      groupedSubscriptions[key] = [];
    }
    groupedSubscriptions[key].push(subscription);
  }

  // Iterate over each group
  for (const key in groupedSubscriptions) {
    const subscriptionGroup = groupedSubscriptions[key];
    const firstSubscription = subscriptionGroup[0];
    const { stripeCustomerId, plan } = firstSubscription;
    if (!stripeCustomerId) continue;

    const user = await db
      .selectFrom("user")
      .where("user.stripeCustomerId", "=", stripeCustomerId)
      .selectAll()
      .executeTakeFirst();
    if (!user) {
      logger.warn(`User not found for stripeCustomerId: ${stripeCustomerId}`);
      continue;
    }

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const historicalInvoices = await stripeClient.invoices.list({
      customer: stripeCustomerId,
      created: {
        gte: firstDayOfMonth.getTime() / 1000,
        lte: lastDayOfMonth.getTime() / 1000,
      },
    });

    const subscriptionIdsInGroup = subscriptionGroup
      .map((s) => s.stripeSubscriptionId)
      .filter((id): id is string => !!id);

    const historicalTotal = historicalInvoices.data
      .filter((invoice) => {
        if (!invoice.subscription) return false;
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription.id;
        return subscriptionIdsInGroup.includes(subId);
      })
      .reduce((sum, invoice) => sum + (invoice.total ?? 0) / 100, 0);

    let upcomingTotal = 0;
    const representativeSubscription = subscriptionGroup.find(
      (s) => s.status === "active",
    );

    if (representativeSubscription?.stripeSubscriptionId) {
      const upcomingInvoice = await stripeClient.invoices.retrieveUpcoming({
        subscription: representativeSubscription.stripeSubscriptionId,
      });
      upcomingTotal = (upcomingInvoice.total ?? 0) / 100;
    }

    const monthlySpentInStripe = historicalTotal + upcomingTotal;

    let monthlySpentInDB = 0;
    if (plan === "pro") {
      const monthlyUsageInDB = await usageService.readCurrentMonthQuota(user);
      monthlySpentInDB = Math.max(
        creditToDollars(monthlyUsageInDB.credit.spent) - FreeCreditInDollars,
        0,
      );
      const diff = monthlySpentInStripe - monthlySpentInDB;
      const logPayload = {
        userId: user.id,
        userEmail: user.email,
        stripeCustomerId,
        plan,
        monthlySpentInDB,
        monthlySpentInStripe,
        diff,
      };
      if (Math.abs(diff) > 1) {
        logger.error(logPayload, "Stripe credit usage mismatch");
      }
    } else if (plan === "organization") {
      const org = await organizationService.readActiveOrganizationByUser(
        user.id,
      );
      if (org) {
        const monthlyQuotaInOrgDB =
          await usageService.readCurrentMonthOrganizationQuota(org.id);
        monthlySpentInDB = creditToDollars(monthlyQuotaInOrgDB.credit.spent);
        const diff = monthlySpentInStripe - monthlySpentInDB;
        const logPayload = {
          userId: user.id,
          userEmail: user.email,
          stripeCustomerId,
          plan,
          orgId: org.id,
          monthlySpentInDB,
          monthlySpentInStripe,
          diff,
        };

        if (Math.abs(diff) > 1) {
          logger.error(logPayload, "Stripe credit usage mismatch");
        }
      } else {
        logger.warn(
          `Organization not found for user ${user.id} with an organization plan subscription.`,
        );
      }
    }
  }
}
export const queue = new Queue<MonitorStripeCreditJobData>(
  QueueName,
  queueConfig,
);

await queue.upsertJobScheduler(
  "every-15-minutes",
  {
    pattern: "*/15 * * * *",
  },
  {
    opts: {
      removeOnComplete: {
        age: 60 * 60 * 24 * 1, // 1 day
      },
      removeOnFail: {
        age: 60 * 60 * 24 * 7, // 7 day
      },
    },
  },
);

export async function createMonitorStripeCreditUsageWorker() {
  return new Worker(
    QueueName,
    async () => {
      await compareSpentCredit();
    },
    queueConfig,
  );
}

function creditToDollars(credit: number): number {
  return credit / 10_000_000;
}
