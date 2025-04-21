import {
  type AppType,
  UserEventSource,
  deviceLinkClient,
} from "@ragdoll/server";
import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { hc } from "hono/client";
import { useCallback, useEffect, useState } from "react";
import {
  authStorage,
  getLocalToken,
  setLocalToken,
  useLocalToken,
} from "./storage";

const DevBaseUrl = "http://localhost:4111";
const ProdBaseUrl = "https://app.getpochi.com";

function setAuthData(data: typeof authClient.$Infer.Session | null) {
  authStorage.setItem("authData", JSON.stringify(data));
}

function getAuthData(): typeof authClient.$Infer.Session | null {
  return JSON.parse(authStorage.getItem("authData") || "null");
}

const authClient = createAuthClient({
  baseURL: isDev() ? DevBaseUrl : ProdBaseUrl,
  plugins: [emailOTPClient(), deviceLinkClient()],
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: getLocalToken,
    },
    onResponse: (ctx) => {
      const authToken = ctx.response.headers.get("set-auth-token"); // get the token from the response headers
      if (authToken) {
        setLocalToken(authToken);
      }
    },
  },
});

export function useAuthApi() {
  const [data, setData] = useState<typeof authClient.$Infer.Session | null>(
    getAuthData(),
  );
  useEffect(() => {
    setAuthData(data);
  }, [data]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ message: string } | null>(null);

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
    setError(null);
  }, []);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await authClient.getSession();
    if (data) {
      setData(data);
    }
    if (error) {
      setError({ message: error.statusText });
    }
    setIsLoading(false);
  }, []);

  const [token] = useLocalToken();
  useEffect(() => {
    if (token) {
      refetch();
    } else {
      reset();
    }
  }, [token, refetch, reset]);

  return {
    data,
    isLoading,
    error,
    authClient,
    async logout() {
      await authClient.revokeSession({
        token,
      });
      setData(null);
      reset();
    },
  };
}

function isDev() {
  return !!process.env.POCHI_DEV_SERVER;
}

function createApiClient() {
  const app = hc<AppType>(isDev() ? DevBaseUrl : ProdBaseUrl, {
    fetch: (input: RequestInfo | URL, requestInit?: RequestInit) => {
      const headers = new Headers(requestInit?.headers);
      headers.append("Authorization", `Bearer ${getLocalToken()}`);
      return fetch(input, {
        ...requestInit,
        headers,
      });
    },
  });
  return app;
}

export const apiClient = createApiClient();

export function createUserEventSource() {
  const eventSource = new UserEventSource(
    isDev() ? DevBaseUrl : ProdBaseUrl,
    getLocalToken(),
  );
  return eventSource;
}
