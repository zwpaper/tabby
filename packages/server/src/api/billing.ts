import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import moment from "moment";
import Stripe from "stripe";
import { z } from "zod";
import { type User, requireAuth } from "../auth";
import { db } from "../db";
import {
  readActiveSubscriptionLimits,
  readCurrentMonthQuota,
} from "../lib/billing";
import { AvailableModels } from "../lib/constants";
import { stripeClient } from "../lib/stripe";

// Define the schema for query parameters for history endpoint
const BillingHistoryQuerySchema = z.object({
  limit: z.string().optional().default("10").transform(Number),
  after: z.string().optional(),
});

const UserIdParamSchema = z.object({
  userId: z.string(),
});

const billing = new Hono()
  .get(
    "/history",
    requireAuth(),
    zValidator("query", BillingHistoryQuerySchema),
    async (c) => {
      const user = c.get("user");
      const { limit, after } = c.req.valid("query");

      if (!user.stripeCustomerId) {
        throw new HTTPException(400, { message: "User is not a customer." });
      }

      try {
        const invoices = await stripeClient.invoices.list({
          customer: user.stripeCustomerId,
          limit: limit,
          starting_after: after,
        });

        return c.json({
          data: invoices.data.map((invoice) => ({
            id: invoice.id,
            created: invoice.created,
            status: invoice.status,
            total: invoice.total,
            currency: invoice.currency,
            url: invoice.hosted_invoice_url,
          })),
          hasMore: invoices.has_more,
        });
      } catch (error) {
        if (error instanceof Stripe.errors.StripeError) {
          throw new HTTPException(400, { message: error.message });
        }
        throw new HTTPException(500, {
          message: "Failed to fetch billing history.",
        });
      }
    },
  )
  .get("/quota/me", requireAuth(), async (c) => {
    const usage = await readCurrentMonthQuota(c.get("user"), c.req);
    return c.json(usage);
  })
  .get(
    "/quota/:userId",
    requireAuth("admin"),
    zValidator("param", UserIdParamSchema),
    async (c) => {
      const { userId } = c.req.valid("param");

      const targetUser = await db
        .selectFrom("user")
        .selectAll()
        .where("id", "=", userId)
        .executeTakeFirst();

      if (!targetUser) {
        throw new HTTPException(404, { message: "User not found" });
      }

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
        targetUser as User,
        c.req,
      );

      return c.json({
        userId,
        limit: userLimits.premium,
        premiumUsageDetails: userMonthlyPremiumUsageDetails.map((usage) => ({
          modelId: usage.modelId,
          count: Number(usage.totalCount),
        })),
      });
    },
  );

export default billing;
