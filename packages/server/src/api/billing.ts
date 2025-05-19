import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import Stripe from "stripe";
import { z } from "zod";
import { type User, requireAuth } from "../auth";
import { db } from "../db";
import { stripeClient } from "../lib/stripe";
import { usageService } from "../service/usage";

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
          data: invoices.data.map((invoice: Stripe.Invoice) => ({
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
    const usage = await usageService.readCurrentMonthQuota(
      c.get("user"),
      c.req,
    );
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

      const usage = await usageService.readCurrentMonthUsage(
        userId,
        targetUser as User,
        c.req,
      );
      return c.json(usage);
    },
  );

export default billing;
