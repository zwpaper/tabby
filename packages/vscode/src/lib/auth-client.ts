import { deviceLinkClient } from "@ragdoll/server";
import { createAuthClient } from "better-auth/react";

const DevBaseUrl = "http://localhost:4111";
const ProdBaseUrl = "https://app.getpochi.com";

function isDev() {
  return !!process.env.POCHI_DEV_SERVER;
}

export const authClient = createAuthClient({
  baseURL: isDev() ? DevBaseUrl : ProdBaseUrl,
  plugins: [deviceLinkClient()],
});
