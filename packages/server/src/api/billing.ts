import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import Stripe from "stripe";
import { z } from "zod";
import { auth, requireAuth } from "../auth";
import type { DB } from "../db/schema"; // Import DB type if needed for context typing
import { db } from "../db";
import { AvailableModels, StripePlans } from "../constants";
import moment from "moment";
import { sql } from "kysely";

// Define the schema for query parameters for history endpoint
const BillingHistoryQuerySchema = z.object({
  limit: z.string().optional().default("10").transform(Number), // Number of invoices to fetch
  after: z.string().optional(), // ID of the invoice to start after for pagination
});

const billing = new Hono<{ Variables: { db: DB } }>() // Add DB type to Hono variables
  .get(
    "/history",
    requireAuth,
    zValidator("query", BillingHistoryQuerySchema),
    async (c) => {
      const user = c.get("user");
      const { limit, after } = c.req.valid("query");

      if (!process.env.STRIPE_SECRET_KEY) {
        throw new HTTPException(500, {
          message: "Billing system not configured.",
        });
      }

      if (!user.stripeCustomerId) {
        throw new HTTPException(400, { message: "User is not a customer." });
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      try {
        const invoices = await stripe.invoices.list({
          customer: user.stripeCustomerId,
          limit: limit,
          starting_after: after,
        });

        // Format the response to match Stripe's list object structure
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
        // Check for specific Stripe errors if needed
        if (error instanceof Stripe.errors.StripeError) {
          throw new HTTPException(400, { message: error.message });
        }
        throw new HTTPException(500, {
          message: "Failed to fetch billing history.",
        });
      }
    },
  )
  .get(
    "/quota", // New quota endpoint
    requireAuth,
    async (c) => {
      const user = c.get("user");

      // Calculate the start of the current month (UTC)
      const now = moment.utc();
      const startOfMonth = now.startOf("month").startOf("hour").toDate()

      const activeSubscription = await auth.api.listActiveSubscriptions({
        headers: c.req.raw.headers,
        query: {
          referenceId: user.id,
        },
      }).then(r => r[0]);

      const limits = activeSubscription?.limits ?? StripePlans[0].limits;

      // Query the total usage count for the current month.
      // Ensure the timestamp comparison works correctly with the database timezone (assuming UTC)
      const results = await db
        .selectFrom("monthlyUsage")
        .select([
          "modelId",
          "count",
        ])
        .where("userId", "=", user.id)
        // Compare the timestamp column directly with the Date object
        .where(sql`"startDayOfMonth" AT TIME ZONE 'UTC'`, "=", startOfMonth)
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

      return c.json({
        usages,
        limits,
      });
    },
  );

export default billing;
