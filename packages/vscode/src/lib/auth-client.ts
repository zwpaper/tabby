import { deviceLinkClient } from "@ragdoll/server";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [deviceLinkClient()],
});
