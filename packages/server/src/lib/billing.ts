import type { HonoRequest } from "hono";
import { sql } from "kysely";
import moment from "moment";
import { type User, auth } from "../auth";
import { db } from "../db";
import { AvailableModels, StripePlans } from "./constants";

export async function readActiveSubscriptionLimits(user: User, r: HonoRequest) {
  const activeSubscription = await auth.api
    .listActiveSubscriptions({
      query: {
        referenceId: user.id,
      },
      headers: r.raw.headers,
    })
    .then((r) => r[0]);

  const planId = activeSubscription?.plan ?? StripePlans[0].name.toLowerCase();
  let limits = activeSubscription?.limits ?? StripePlans[0].limits;
  if (user.isWaitlistApproved) {
    limits =
      StripePlans.find((p) => p.name === "Pro")?.limits ??
      StripePlans[0].limits;
  } else if (user.email.endsWith("@tabbyml.com")) {
    limits = {
      basic: 100_000,
      premium: 10_000,
    };
  }

  return {
    plan: planId.charAt(0).toUpperCase() + planId.slice(1),
    limits,
  };
}

export async function readCurrentMonthQuota(user: User, r: HonoRequest) {
  // Calculate the start of the current month (UTC)
  const now = moment.utc();
  const startOfMonth = now.startOf("month").toDate();

  const { plan, limits } = await readActiveSubscriptionLimits(user, r);

  // Query the total usage count for the current month.
  // Ensure the timestamp comparison works correctly with the database timezone (assuming UTC)
  const results = await db
    .selectFrom("monthlyUsage")
    .select(["modelId", "count"])
    .where("userId", "=", user.id)
    // Compare the timestamp column directly with the Date object
    .where(sql`"startDayOfMonth"`, "=", startOfMonth)
    .execute(); // Use executeTakeFirstOrThrow() if you expect a result or want an error
  console.log(results);

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

  return {
    plan,
    usages,
    limits,
  };
}
