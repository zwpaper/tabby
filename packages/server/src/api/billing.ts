import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import Stripe from "stripe";
import { z } from "zod";
import { requireAuth } from "../auth";
import type { DB } from "../db/schema"; // Import DB type if needed for context typing
import { readCurrentMonthQuota } from "../lib/billing";
import { stripeClient } from "../lib/stripe";

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

      if (!user.stripeCustomerId) {
        throw new HTTPException(400, { message: "User is not a customer." });
      }

      try {
        const invoices = await stripeClient.invoices.list({
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
      const usage = await readCurrentMonthQuota(c.get("user"), c.req);
      return c.json(usage);
    },
  );

export default billing;
