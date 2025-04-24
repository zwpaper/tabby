import {
  type ResponseContext,
  createAuthClient as createAuthClientImpl,
} from "better-auth/react";
import type { VSCodeHost } from "./vscode-host";

const DevBaseUrl = "http://localhost:4113";
const ProdBaseUrl = "https://app.getpochi.com";

function isDev() {
  return false;
}

export function createAuthClient(vscodeHost: VSCodeHost) {
  const authClient = createAuthClientImpl({
    baseURL: isDev() ? DevBaseUrl : ProdBaseUrl,

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
