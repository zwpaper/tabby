import type { HonoRequest } from "hono";
import { type User, auth } from "../auth";
import { StripePlans } from "./constants";

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
