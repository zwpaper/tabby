import { createAuthHooks } from "@daveyplate/better-auth-tanstack";
import { threadSignal } from "@quilted/threads/signals";
import type { AppType } from "@ragdoll/server";
import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import {
  type ResponseContext,
  createAuthClient as createAuthClientImpl,
} from "better-auth/react";
import { hc } from "hono/client";
import { vscodeHost } from "./vscode";

const tokenPromise = vscodeHost.readToken().then(threadSignal);

function createAuthClient() {
  const authClient = createAuthClientImpl({
    baseURL: getServerBaseUrl(),
    fetchOptions: {
      auth: {
        type: "Bearer",
        token: async () => tokenPromise.then((signal) => signal.value),
      },
    },
    onResponse: (ctx: ResponseContext) => {
      const authToken = ctx.response.headers.get("set-auth-token"); // get the token from the response headers
      if (authToken) {
        tokenPromise.then((signal) => {
          signal.value = authToken;
        });
      }
    },
  });

  return authClient;
}

export const authClient = createAuthClient();
export type User = (typeof authClient.$Infer.Session)["user"];

export const authHooks = createAuthHooks(authClient);

function createApiClient() {
  const app = hc<AppType>(getServerBaseUrl(), {
    fetch: async (input: RequestInfo | URL, requestInit?: RequestInit) => {
      const token = await tokenPromise;
      const headers = new Headers(requestInit?.headers);
      headers.append("Authorization", `Bearer ${token.value}`);
      return fetch(input, {
        ...requestInit,
        headers,
      });
    },
  });
  return app;
}

export const apiClient = createApiClient();
