import { createAuthHooks } from "@daveyplate/better-auth-tanstack";
import type { PochiApi } from "@getpochi/base";
import { type ThreadSignal, threadSignal } from "@quilted/threads/signals";
import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import { useQuery } from "@tanstack/react-query";
import {
  type ResponseContext,
  createAuthClient as createAuthClientImpl,
} from "better-auth/react";
import { hc } from "hono/client";
import { vscodeHost } from "./vscode";

let TokenPromise: Promise<ThreadSignal<string | undefined>> | null = null;
let ExtensionVersionPromise: Promise<string> | null = null;

const getToken = () => {
  if (!TokenPromise) {
    TokenPromise = vscodeHost.readToken().then(threadSignal);
  }
  return TokenPromise;
};

const getExtensionVersion = () => {
  if (!ExtensionVersionPromise) {
    ExtensionVersionPromise = vscodeHost.readExtensionVersion();
  }
  return ExtensionVersionPromise;
};

const customFetchImpl = async (
  input: RequestInfo | URL,
  requestInit?: RequestInit,
) => {
  const token = await getToken();
  const extensionVersion = await getExtensionVersion();
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
          getToken().then((signal) => {
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
  const app = hc<PochiApi>(getServerBaseUrl(), {
    fetch: customFetchImpl,
  });
  return app;
}

export function useToken(): string | undefined {
  const { data } = useQuery({
    queryKey: ["token"],
    queryFn: getToken,
  });

  return data?.value;
}

export const apiClient = createApiClient();
