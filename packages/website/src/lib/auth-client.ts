import { stripeClient } from "@better-auth/stripe/client";
import { type AppType, type auth, deviceLinkClient } from "@ragdoll/server";
import {
  adminClient,
  inferAdditionalFields,
  magicLinkClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { hc } from "hono/client";
import posthog from "posthog-js";

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    magicLinkClient(),
    deviceLinkClient(),
    stripeClient({ subscription: true }),
    inferAdditionalFields<typeof auth>(),
  ],
  fetchOptions: {
    onResponse: (ctx) => {
      if (ctx.response.headers.get("set-auth-token")) {
        setTimeout(() => {
          identifyUser();
        }, 1000);
      }
    },
  },
});

const identifyUser = () => {
  authClient.getSession().then(({ data }) => {
    if (data?.user) {
      posthog.identify(data.user.id, {
        email: data.user.email,
        name: data.user.name,
      });
    }
  });
};

export const apiClient = hc<AppType>("/");

export type Session = typeof authClient.$Infer.Session;
export type User = Session["user"];
