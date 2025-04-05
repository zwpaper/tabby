import { stripeClient } from "@better-auth/stripe/client";
import { deviceLinkClient, type AppType } from "@ragdoll/server";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { hc } from "hono/client";

const BearerTokenStorageKey = "bearer_token";

export const authClient = createAuthClient({
  plugins: [
    magicLinkClient(),
    deviceLinkClient(),
    stripeClient({ subscription: true }),
  ],
  fetchOptions: {
    onSuccess: (ctx) => {
        const authToken = ctx.response.headers.get("set-auth-token") // get the token from the response headers
        // Store the token securely (e.g., in localStorage)
        if(authToken){
          console.log("Storing token", authToken);
          localStorage.setItem(BearerTokenStorageKey, authToken);
        }
    }
}
});

export const apiClient = hc<AppType>("/")