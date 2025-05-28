import { deviceLinkClient } from "@ragdoll/server";
import type { AppType } from "@ragdoll/server";
import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import { createAuthClient as createAuthClientImpl } from "better-auth/react";
import { hc } from "hono/client";
import type { DependencyContainer } from "tsyringe";
import { PostHog } from "./posthog";
import { TokenStorage } from "./token-storage";

export function createAuthClient(container: DependencyContainer) {
  const tokenStorage = container.resolve(TokenStorage);
  const posthog = container.resolve(PostHog);

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

  identifyUser();
  return authClient;
}

export function createApiClient(container: DependencyContainer) {
  const tokenStorage = container.resolve(TokenStorage);

  const app = hc<AppType>(getServerBaseUrl(), {
    headers: {
      Authorization: `Bearer ${tokenStorage.token.value}`,
    },
  });

  return app;
}

export type AuthClient = ReturnType<typeof createAuthClient>;
export type ApiClient = ReturnType<typeof createApiClient>;
