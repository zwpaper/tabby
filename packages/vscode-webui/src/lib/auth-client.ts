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
const extensionVersionPromise = vscodeHost.readExtensionVersion();

const customFetchImpl = async (
  input: RequestInfo | URL,
  requestInit?: RequestInit,
) => {
  const token = await tokenPromise;
  const extensionVersion = await extensionVersionPromise;
  const headers = new Headers(requestInit?.headers);
  headers.append("Authorization", `Bearer ${token.value}`);
  headers.set("X-Pochi-Extension-Version", extensionVersion);
  return fetch(input, {
    ...requestInit,
    headers,
  });
};

function createAuthClient() {
  const authClient = createAuthClientImpl({
    baseURL: getServerBaseUrl(),
    fetchOptions: {
      customFetchImpl,
      onResponse: (ctx: ResponseContext) => {
        const authToken = ctx.response.headers.get("set-auth-token"); // get the token from the response headers
        if (authToken) {
          tokenPromise.then((signal) => {
            signal.value = authToken;
          });
        }
      },
    },
  });

  return authClient;
}

export const authClient = createAuthClient();
export type User = (typeof authClient.$Infer.Session)["user"];

export const authHooks = createAuthHooks(authClient);

function createApiClient() {
  const app = hc<AppType>(getServerBaseUrl(), {
    fetch: customFetchImpl,
  });
  return app;
}

export function readToken() {
  return tokenPromise.then((x) => x.value);
}

export const apiClient = createApiClient();
