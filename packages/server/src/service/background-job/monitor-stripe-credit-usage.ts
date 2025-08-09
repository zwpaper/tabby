import { getLogger } from "@ragdoll/common";
import { Queue, Worker } from "bullmq";
import { db } from "../../db";
import { stripeClient } from "../../lib/stripe";

import { usageService } from "../usage";
import { queueConfig } from "./redis";

const QueueName = "monitor-stripe-credit";

const logger = getLogger("MonitorStripeCredit");

const FreeCreditInDollars = 20;

const SubscriptionIdWhiteList = [
  {
    subscriptionId: "cBo0qBWX2cSi9G0GyXuP7KzfDh7LSmo",
    stripeSubscriptionId: "sub_1RprFvDZw4FSeDxlAeZ7rgp3",
    plan: "pro",
    userId: "gYuqEEgaOhGftTCxpz7lS3lkcVkTfODv",
    email: "yannickhel@googlemail.com",
  },
  {
    subscriptionId: "VRHQXdymisNDza5vj2fwzkk5BTkVRbnv",
    stripeSubscriptionId: "sub_1RpnQjDZw4FSeDxlQoMFpY2B",
    plan: "organizaition",
    organizationId: "uyr0dLBW30GK5Lm5ztXFVyVL3z0vOzGr",
    userId: "hD5dfrOhMnE9GsxJHCC959CZAh2CnBe5",
    email: "fungjuelaing@gmail.com",
  },
  {
    subscriptionId: "BrcEHqSx8nMiq6cy4cpXITmfzEumSahz",
    stripeSubscriptionId: "sub_1RpT49DZw4FSeDxloVSaCZ9a",
    plan: "pro",
    userId: "4PsfuD4foxAbGLknszouBMUDcBMa4pDK",
    email: "ralf.lorini@studium.fernuni-hagen.de",
  },
  {
    subscriptionId: "5awl0QONih19HtwKg6mAaKeeFFkzpp3g",
    stripeSubscriptionId: "sub_1RpSxWDZw4FSeDxluVym8oSZ",
    plan: "pro",
    userId: "lyi8brmuFrqLRWQe0VA2VLlwWVeZcGIO",
    email: "ralf.lorini@gmail.com",
  },
  {
    subscriptionId: "3n2UdrrH8IZ1PfiA9wjMVpbSZGJP6YJ7",
    stripeSubscriptionId: "sub_1RpGLlDZw4FSeDxlpRWuKMCP",
    plan: "pro",
    userId: "bVx8jy5Zt7uHefsLqoYLLYNKq5dtOTXq",
    email: "chad.green@lanternlabs.com",
  },
  {
    subscriptionId: "HIJTnrsBb5zZyemUXUVDYIHFCaQTkDZW",
    stripeSubscriptionId: "sub_1Ro2WBDZw4FSeDxltZn80aGX",
    plan: "organization",
    organizationId: "uDFFt6lgZlai2qHulrGJBVhoxVmFGTmm",
    userId: "0w5x1oBboKDYnxF6vQXCaWJDU92rnqPH",
    email: "jo.allard18@gmail.com",
  },
  {
    subscriptionId: "USOuXz8B2cNtgRKLvU5EBwqdJ08IyA5r",
    stripeSubscriptionId: "sub_1Rm9GJDZw4FSeDxlBzBShdgI",
    plan: "pro",
    userId: "Bc5CHlbb3qPqt4rkkx8Z5LNNiL2udp8F",
    email: "jueliang@tabbyml.com",
  },
  {
    subscriptionId: "Q8mZgxlhLOjM6845zKXIDiQ2lKb3PV71",
    stripeSubscriptionId: "sub_1RlMZTDZw4FSeDxl0M7EYZ1O",
    plan: "pro",
    userId: "XZ5E6Ge4K73adWOmQCDZS8dUfFL0K7Ik",
    email: "gyxlucy@gmail.com",
  },
  {
    subscriptionId: "mTv9y1bkPrW5w7nxUcsgfy9JEZ4SQFUD",
    stripeSubscriptionId: "sub_1RiBg0DZw4FSeDxle91y4gct",
    plan: "pro",
    userId: "3aJsRqxexIpYoBkbkQ6BrVO0eBBAneED",
    email: "demidov@dimti.ru",
  },
  {
    subscriptionId: "1u4e2itG2XQxrLPmSyWO9E9ssCRWir6i",
    stripeSubscriptionId: "sub_1Rh6eQDZw4FSeDxlbs0AEPmc",
    plan: "pro",
    userId: "wWQJmkV9MwQyyvo2IzfUmCRwfRz7JGY5",
    email: "gyxlucy@tabbyml.com",
  },
  {
    subscriptionId: "VoXBT0noaRvcEsSeQYpMIwNqhHDhATaN",
    stripeSubscriptionId: "sub_1Rrvt5DZw4FSeDxlj4jrn32s",
    plan: "pro",
    userId: "78wpcwX3zgX438XH7Chg9UjUTi8S5OuH",
    email: "dqikst@gmail.com",
  },
  // FIXME(jueliang): should be remove after 2025-09-01
  {
    subscriptionId: "c6KNf7b47RTQz2trg5PevUnvrSBur0Ir",
    stripeSubscriptionId: "sub_1RrloKDZw4FSeDxlM3Qsfk72",
    plan: "pro",
    userId: "6tHTVke2dZvzcgtTigmVFnaf2UdvEaHt",
    email: "dwido906@outlook.com",
  },
  // FIXME(jueliang): should be remove after 2025-09-01
  {
    subscriptionId: "sEFhGBQ5Vcv3fSPfiXzFoIuWbDn8PDHt",
    stripeSubscriptionId: "sub_1RrJPdDZw4FSeDxlYnJ1JlYX",
    plan: "organization",
    organizationId: "y4OL4vrYm5HaMHw9StqHIQa4RwydCkwC",
    userId: "ZKB8zG3fUC3cTqAQVJjD0hAtnQhKWKWh",
    email: "fungjueliang@gmail.com",
  },
];

const OrganizationWhiteList = [
  {
    organizationId: "qiIwhkkBvJalWyzb8EfRMc1YrScHgYsm",
    owner: {
      email: "meng@tabbyml.com",
      userId: "XdopM9buei3UDnsaRcxMcZ90H2hJElLM",
    },
  },
];

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

  // Group subscriptions by referenceId and plan to handle multiple subscriptions for the same entity (e.g., organization with multiple members).
  // This ensures that all related subscriptions are processed together.
  const groupedSubscriptions: Record<string, typeof subscriptions> = {};
  for (const subscription of subscriptions) {
    if (!subscription.referenceId || !subscription.plan) continue;

    const key = `${subscription.referenceId}-${subscription.plan}`;
    if (!groupedSubscriptions[key]) {
      groupedSubscriptions[key] = [];
    }
    groupedSubscriptions[key].push(subscription);
  }

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfNextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
  );

  // Iterate over each group
  for (const key in groupedSubscriptions) {
    const subscriptionGroup = groupedSubscriptions[key];
    const firstSubscription = subscriptionGroup[0];
    const plan = firstSubscription.plan;
    const referenceId = firstSubscription.referenceId;

    if (!plan || !referenceId) continue;

    const stripeCustomerIds = [
      ...new Set(
        subscriptionGroup
          .map((s) => s.stripeCustomerId)
          .filter((id): id is string => !!id),
      ),
    ];

    const stripeSubscriptionIds = subscriptionGroup
      .map((s) => s.stripeSubscriptionId)
      .filter((id): id is string => !!id);

    if (plan === "pro") {
      if (stripeCustomerIds.length === 0) {
        logger.warn(`No stripe customer found for referenceId: ${referenceId}`);
        continue;
      }

      const stripeCustomerId = stripeCustomerIds[0];
      const user = await db
        .selectFrom("user")
        .where("stripeCustomerId", "=", stripeCustomerId)
        .selectAll()
        .executeTakeFirst();

      if (!user) {
        logger.warn(`User not found for stripeCustomerId: ${stripeCustomerId}`);
        continue;
      }

      // Fetches all historical invoices for the current month for a specific customer.
      // This is used to calculate the total amount spent in Stripe for the current billing period.
      const historicalInvoicesForCurrentMonth =
        await stripeClient.invoices.list({
          customer: stripeCustomerId,
          created: {
            gte: Math.floor((firstDayOfMonth.getTime() - 1) / 1000),
            lt: Math.floor((firstDayOfNextMonth.getTime() - 1) / 1000),
          },
        });

      const isInWhiteList = subscriptionGroup.some(
        (s) =>
          SubscriptionIdWhiteList.findIndex((x) => x.subscriptionId === s.id) >
          -1,
      );

      const historicalTotal = historicalInvoicesForCurrentMonth.data
        .filter(
          (invoice) =>
            invoice.subscription &&
            typeof invoice.subscription === "string" &&
            stripeSubscriptionIds.includes(invoice.subscription),
        )
        .reduce((sum, invoice) => sum + invoice.amount_due / 100, 0);

      let upcomingTotal = 0;
      const representativeSubscription = subscriptionGroup.find(
        (s) => s.status === "active",
      );

      if (representativeSubscription?.stripeSubscriptionId) {
        const upcomingInvoice = await stripeClient.invoices.retrieveUpcoming({
          subscription: representativeSubscription.stripeSubscriptionId,
        });
        upcomingTotal = upcomingInvoice.amount_due / 100;
      }

      const monthlySpentInStripe = historicalTotal + upcomingTotal;

      const monthlyUsageInDB = await usageService.readCurrentMonthQuota(user);
      const monthlySpentInDB = Math.max(
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
        if (isInWhiteList) {
          logger.info(logPayload, "Stripe credit usage mismatch (whitelisted)");
        } else {
          logger.error(logPayload, "Stripe credit usage mismatch");
        }
      }
    } else if (plan === "organization") {
      const orgId = referenceId;
      let totalHistorical = 0;

      // For organization plans, iterate through all stripe customer IDs associated with the organization
      // and fetch their historical invoices for the current month.
      // This is necessary because an organization can have multiple members with payment permissions,
      // each with their own stripe customer ID.
      for (const stripeCustomerId of stripeCustomerIds) {
        const historicalInvoicesForCurrentMonth =
          await stripeClient.invoices.list({
            customer: stripeCustomerId,
            created: {
              gte: Math.floor((firstDayOfMonth.getTime() - 1) / 1000),
              lt: Math.floor((firstDayOfNextMonth.getTime() - 1) / 1000),
            },
          });
        totalHistorical += historicalInvoicesForCurrentMonth.data
          .filter(
            (invoice) =>
              invoice.subscription &&
              typeof invoice.subscription === "string" &&
              stripeSubscriptionIds.includes(invoice.subscription),
          )
          .reduce((sum, invoice) => sum + invoice.amount_due / 100, 0);
      }

      let totalUpcoming = 0;
      const representativeSubscription = subscriptionGroup.find(
        (s) => s.status === "active",
      );

      if (representativeSubscription?.stripeSubscriptionId) {
        const upcomingInvoice = await stripeClient.invoices.retrieveUpcoming({
          subscription: representativeSubscription.stripeSubscriptionId,
        });
        totalUpcoming = upcomingInvoice.amount_due / 100;
      }
      const monthlySpentInStripe = totalHistorical + totalUpcoming;

      const monthlyQuotaInOrgDB =
        await usageService.readCurrentMonthOrganizationQuota(orgId);
      const monthlySpentInDB = creditToDollars(
        monthlyQuotaInOrgDB.credit.spent,
      );
      const diff = monthlySpentInStripe - monthlySpentInDB;

      const isInWhiteList =
        subscriptionGroup.some(
          (s) =>
            SubscriptionIdWhiteList.findIndex(
              (x) => x.subscriptionId === s.id,
            ) > -1,
        ) ||
        OrganizationWhiteList.findIndex((x) => x.organizationId === orgId) > -1;

      const owner = await db
        .selectFrom("member")
        .innerJoin("user", "user.id", "member.userId")
        .where("member.organizationId", "=", orgId)
        .where("member.role", "=", "owner")
        .select(["user.email", "user.id as userId"])
        .executeTakeFirst();

      const logPayload = {
        orgId,
        stripeCustomerIds,
        plan,
        monthlySpentInDB,
        monthlySpentInStripe,
        diff,
        owner,
      };

      if (Math.abs(diff) > 1) {
        if (isInWhiteList) {
          logger.info(logPayload, "Stripe credit usage mismatch (whitelisted)");
        } else {
          logger.error(logPayload, "Stripe credit usage mismatch");
        }
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
