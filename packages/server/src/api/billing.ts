import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import Stripe from "stripe";
import { z } from "zod";
import { requireAuth } from "../auth";

// Define the schema for query parameters
const BillingHistoryQuerySchema = z.object({
  limit: z.string().optional().default("10").transform(Number), // Number of invoices to fetch
  after: z.string().optional(), // ID of the invoice to start after for pagination
});

const billing = new Hono().get(
  "/history",
  requireAuth,
  zValidator("query", BillingHistoryQuerySchema),
  async (c) => {
    const user = c.get("user");
    const { limit, after } = c.req.valid("query");

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("Stripe secret key is not configured.");
      return c.json({ error: "Billing system not configured." }, 500);
    }

    if (!user.stripeCustomerId) {
      return c.json({ error: "User is not a customer." }, 400);
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
        })),
        hasMore: invoices.has_more,
      });
    } catch (error) {
      console.error("Error fetching Stripe invoices:", error);
      // Check for specific Stripe errors if needed
      if (error instanceof Stripe.errors.StripeError) {
        return c.json({ error: error.message }, 400);
      }
      return c.json({ error: "Failed to fetch billing history." }, 500);
    }
  },
);

export default billing;
