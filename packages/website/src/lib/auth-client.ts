import { stripeClient } from "@better-auth/stripe/client";
import { type AppType, type auth, deviceLinkClient } from "@ragdoll/server";
import {
  adminClient,
  inferAdditionalFields,
  magicLinkClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { hc } from "hono/client";

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    magicLinkClient(),
    deviceLinkClient(),
    stripeClient({ subscription: true }),
    inferAdditionalFields<typeof auth>(),
  ],
});

export const apiClient = hc<AppType>("/");

export type Session = typeof authClient.$Infer.Session;
export type User = Session["user"];
