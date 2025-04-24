import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import {
  type ResponseContext,
  createAuthClient as createAuthClientImpl,
} from "better-auth/react";
import type { VSCodeHost } from "./vscode-host";

export function createAuthClient(vscodeHost: VSCodeHost) {
  const authClient = createAuthClientImpl({
    baseURL: getServerBaseUrl(),
    fetchOptions: {
      auth: {
        type: "Bearer",
        token: async () => await vscodeHost.getToken(),
      },
    },
    onResponse: (ctx: ResponseContext) => {
      const authToken = ctx.response.headers.get("set-auth-token"); // get the token from the response headers
      if (authToken) {
        vscodeHost.setToken(authToken);
      }
    },
  });

  return authClient;
}

export type AuthClient = ReturnType<typeof createAuthClient>;
