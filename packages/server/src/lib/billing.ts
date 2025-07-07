import type { User } from "../auth";
import { db } from "../db";
import { StripePlans } from "./constants";

export async function readActiveSubscriptionLimits(user: User) {
  const activeSubscription = await db
    .selectFrom("subscription")
    .select(["id", "plan"])
    .where("referenceId", "=", user.id)
    .where("status", "=", "active")
    .executeTakeFirst();

  const planId = activeSubscription?.plan ?? StripePlans[0].name.toLowerCase();
  let limits =
    StripePlans.find((p) => p.name.toLowerCase() === planId)?.limits ||
    StripePlans[0].limits;
  if (user.email.endsWith("@tabbyml.com")) {
    limits = {
      basic: 100_000,
      premium: 15_000,
    };
  } else if (user.isWaitlistApproved) {
    limits =
      StripePlans.find((p) => p.name === "Pro")?.limits ?? // TODO: fix this
      StripePlans[0].limits;
  }

  return {
    plan: planId.charAt(0).toUpperCase() + planId.slice(1),
    limits,
  };
}
