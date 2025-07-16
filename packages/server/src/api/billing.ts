import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sql } from "kysely";
import Stripe from "stripe";
import { z } from "zod";
import { requireAuth } from "../auth";
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

const OrgIdParamSchema = z.object({
  orgId: z.string(),
});

const PortalQuerySchema = z.object({
  return_pathname: z.string().optional(),
});

const billing = new Hono()
  .get(
    "/portal",
    requireAuth(),
    zValidator("query", PortalQuerySchema),
    async (c) => {
      const { return_pathname = "profile" } = c.req.valid("query");
      const user = c.get("user");
      if (!user.stripeCustomerId) {
        throw new HTTPException(400, { message: "User is not a customer." });
      }

      const url = new URL(c.req.url);
      const return_url = `${url.origin}/${return_pathname}`;

      const session = await stripeClient.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url,
      });
      return c.redirect(session.url, 303);
    },
  )
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
    const usage = await usageService.readCurrentMonthQuota(c.get("user"));
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

      const usage = await usageService.readCurrentMonthUsage(userId);
      return c.json(usage);
    },
  )
  .put(
    "/quota/me/usage",
    requireAuth(),
    zValidator(
      "json",
      z.object({
        limit: z.number().int().min(10).max(2000),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      const { limit } = c.req.valid("json");
      await db
        .insertInto("monthlyCreditLimit")
        .values({
          userId: user.id,
          limit,
        })
        .onConflict((oc) =>
          oc
            .column("userId")
            .doUpdateSet({ limit, updatedAt: sql`CURRENT_TIMESTAMP` }),
        )
        .execute();

      return c.json({ success: true });
    },
  )
  .get(
    "/quota/organization/:orgId",
    requireAuth(),
    zValidator("param", OrgIdParamSchema),
    async (c) => {
      const user = c.get("user");
      const { orgId } = c.req.valid("param");
      const member = await db
        .selectFrom("member")
        .selectAll()
        .where("userId", "=", user.id)
        .executeTakeFirst();
      if (
        !member ||
        !member.organizationId ||
        member.organizationId !== orgId
      ) {
        throw new HTTPException(403, { message: "Forbidden" });
      }

      const quota = await usageService.readCurrentMonthOrganizationQuota(orgId);
      return c.json(quota);
    },
  )
  .put(
    "/quota/organization/:orgId/usage",
    requireAuth(),
    zValidator("param", OrgIdParamSchema),
    zValidator(
      "json",
      z.object({
        limit: z.number().int().min(10).max(50_000),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      const { orgId } = c.req.valid("param");
      const member = await db
        .selectFrom("member")
        .selectAll()
        .where("userId", "=", user.id)
        .executeTakeFirst();
      if (
        !member ||
        !member.organizationId ||
        member.organizationId !== orgId ||
        (member.role !== "owner" && member.role !== "admin")
      ) {
        throw new HTTPException(403, { message: "Forbidden" });
      }

      const { limit } = c.req.valid("json");
      await db
        .insertInto("monthlyOrganizationCreditLimit")
        .values({
          organizationId: orgId,
          limit,
        })
        .onConflict((oc) =>
          oc
            .column("organizationId")
            .doUpdateSet({ limit, updatedAt: sql`CURRENT_TIMESTAMP` }),
        )
        .execute();

      return c.json({ success: true });
    },
  )
  .get(
    "/invoices",
    requireAuth(),
    zValidator(
      "query",
      z.object({
        subscriptionId: z.string(),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      const { subscriptionId } = c.req.valid("query");

      const subscription = await db
        .selectFrom("subscription")
        .where("id", "=", subscriptionId)
        .select(["stripeCustomerId", "stripeSubscriptionId"])
        .executeTakeFirst();

      if (!subscription?.stripeSubscriptionId) {
        throw new HTTPException(404, { message: "Subscription not found" });
      }

      if (
        !user.stripeCustomerId ||
        subscription.stripeCustomerId !== user.stripeCustomerId
      ) {
        throw new HTTPException(403, { message: "Forbidden" });
      }

      try {
        const upcomingInvoice = await stripeClient.invoices.retrieveUpcoming({
          subscription: subscription.stripeSubscriptionId,
        });

        return c.json(upcomingInvoice);
      } catch (error) {
        console.error("Failed to retrieve upcoming invoice:", error);
        if (error instanceof Stripe.errors.StripeError) {
          throw new HTTPException(400, { message: error.message });
        }
        throw new HTTPException(500, {
          message: "Failed to retrieve upcoming invoice.",
        });
      }
    },
  );

export default billing;
