import { deviceLinkClient } from "@ragdoll/server";
import { createAuthClient as createAuthClientImpl } from "better-auth/react";
import type { TokenStorage } from "./token-storage";

const DevBaseUrl = "http://localhost:4113";
const ProdBaseUrl = "https://app.getpochi.com";

function isDev() {
  return false;
}

export function getBaseUrl() {
  return isDev() ? DevBaseUrl : ProdBaseUrl;
}

export function createAuthClient(tokenStorage: TokenStorage) {
  const authClient = createAuthClientImpl({
    baseURL: getBaseUrl(),
    plugins: [deviceLinkClient()],

    fetchOptions: {
      auth: {
        type: "Bearer",
        token: () => tokenStorage.getToken(),
      },
      onResponse: (ctx) => {
        const authToken = ctx.response.headers.get("set-auth-token"); // get the token from the response headers
        if (authToken) {
          tokenStorage.setToken(authToken);
        }
      },
    },
  });

  return authClient;
}

export type AuthClient = ReturnType<typeof createAuthClient>;
