import type * as vscode from "vscode";

import { deviceLinkClient } from "@ragdoll/server";
import { createAuthClient as createAuthClientImpl } from "better-auth/react";

const DevBaseUrl = "http://localhost:4111";
const ProdBaseUrl = "https://app.getpochi.com";
const BearerTokenKey = "bearer_token";

function isDev() {
  return false;
}

export function createAuthClient(context: vscode.ExtensionContext) {
  const updateToken = (token: string) => {
    context.globalState.update(BearerTokenKey, token);
  };

  const getToken = () => {
    return context.globalState.get<string>(BearerTokenKey) || "";
  };

  const authClient = createAuthClientImpl({
    baseURL: isDev() ? DevBaseUrl : ProdBaseUrl,
    plugins: [deviceLinkClient()],

    fetchOptions: {
      auth: {
        type: "Bearer",
        token: getToken,
      },
      onResponse: (ctx) => {
        const authToken = ctx.response.headers.get("set-auth-token"); // get the token from the response headers
        if (authToken) {
          updateToken(authToken);
        }
      },
    },
  });

  return authClient;
}

export type AuthClient = ReturnType<typeof createAuthClient>;
