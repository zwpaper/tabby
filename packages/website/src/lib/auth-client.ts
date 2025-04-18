import { stripeClient } from "@better-auth/stripe/client";
import { type AppType, deviceLinkClient } from "@ragdoll/server";
import { adminClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { hc } from "hono/client";

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    magicLinkClient(),
    deviceLinkClient(),
    stripeClient({ subscription: true }),
  ],
});

export const apiClient = hc<AppType>("/");
