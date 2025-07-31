import { getLogger } from "@ragdoll/common";
import { Queue, Worker } from "bullmq";
import { db } from "../../db";
import { stripeClient } from "../../lib/stripe";
import { organizationService } from "../organization";
import { usageService } from "../usage";
import { queueConfig } from "./redis";

const QueueName = "monitor-stripe-credit";

const logger = getLogger("MonitorStripeCredit");

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
    .selectAll()
    .execute();
  for (const subscription of subscriptions) {
    if (!subscription.stripeCustomerId) continue;

    const user = await db
      .selectFrom("user")
      .where("user.stripeCustomerId", "=", subscription.stripeCustomerId)
      .selectAll()
      .executeTakeFirst();
    if (!user) continue;

    let monthlySpentInDB = 0;
    if (subscription.plan === "pro") {
      const monthlyUsageInDB = await usageService.readCurrentMonthQuota(user);
      monthlySpentInDB = creditToDollars(monthlyUsageInDB.credit.spent);
    } else if (subscription.plan === "organization") {
      const org = await organizationService.readActiveOrganizationByUser(
        user.id,
      );
      if (!org) continue;

      const monthlyQuotaInOrgDB =
        await usageService.readCurrentMonthOrganizationQuota(org.id);
      monthlySpentInDB = creditToDollars(monthlyQuotaInOrgDB.credit.spent);
    }

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const invoices = await stripeClient.invoices.list({
      customer: subscription.stripeCustomerId,
      created: {
        gte: firstDayOfMonth.getTime() / 1000,
        lte: lastDayOfMonth.getTime() / 1000,
      },
    });

    const monthlySpentInStripe = invoices.data.reduce(
      (sum, invoice) => sum + invoice.total / 100,
      0,
    );

    const diff = Math.abs(monthlySpentInStripe - monthlySpentInDB);
    if (diff > 1) {
      logger.error(
        `Stripe credit usage mismatch for subscription [${subscription.id}]. DB: ${monthlySpentInDB}, Stripe: ${monthlySpentInStripe}`,
      );
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
    pattern: "*/3 * * * *",
  },
  {
    opts: {
      removeOnComplete: {
        age: 60 * 60 * 24 * 1, // 1 day
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
