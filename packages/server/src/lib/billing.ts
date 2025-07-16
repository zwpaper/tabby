import { db } from "../db";
import { StripePlans } from "./constants";

export async function readActiveSubscription(user: {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
}) {
  const activeSubscription = await db
    .selectFrom("subscription")
    .select(["id", "plan"])
    .where("referenceId", "=", user.id)
    .where("status", "=", "active")
    .where("cancelAtPeriodEnd", "=", false)
    .executeTakeFirst();

  const planId = activeSubscription?.plan ?? StripePlans[0].name.toLowerCase();
  return {
    plan: planId.charAt(0).toUpperCase() + planId.slice(1),
  };
}
