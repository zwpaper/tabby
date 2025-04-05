import { stripeClient } from "@better-auth/stripe/client";
import { deviceLinkClient } from "@ragdoll/server";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    magicLinkClient(),
    deviceLinkClient(),
    stripeClient({ subscription: true }),
  ],
});
