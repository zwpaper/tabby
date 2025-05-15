import { deviceLinkClient } from "@ragdoll/server";
import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import { createAuthClient as createAuthClientImpl } from "better-auth/react";
import type { DependencyContainer } from "tsyringe";
import { TokenStorage } from "./token-storage";

export function createAuthClient(container: DependencyContainer) {
  const tokenStorage = container.resolve(TokenStorage);
  const authClient = createAuthClientImpl({
    baseURL: getServerBaseUrl(),
    plugins: [deviceLinkClient()],

    fetchOptions: {
      auth: {
        type: "Bearer",
        token: () => tokenStorage.token.value,
      },
      onResponse: (ctx) => {
        const authToken = ctx.response.headers.get("set-auth-token"); // get the token from the response headers
        if (authToken) {
          tokenStorage.token.value = authToken;
        }
      },
    },
  });

  return authClient;
}

export type AuthClient = ReturnType<typeof createAuthClient>;
