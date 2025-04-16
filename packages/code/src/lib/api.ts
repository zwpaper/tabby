import {
  type AppType,
  UserEventSource,
  deviceLinkClient,
} from "@ragdoll/server";
import type { Session, User } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { hc } from "hono/client";
import { useCallback, useEffect, useState } from "react";
import { authStorage } from "./storage";

const DevBaseUrl = "http://localhost:4111";
const ProdBaseUrl = "https://app.getpochi.com";

function setAuthData(data: { user: User; session: Session } | null) {
  authStorage.setItem("authData", JSON.stringify(data));
}

function getAuthData() {
  return JSON.parse(authStorage.getItem("authData") || "null");
}

function setToken(token: string) {
  authStorage.setItem("authToken", token);
}

function getToken() {
  return authStorage.getItem("authToken") || "";
}

const authClient = createAuthClient({
  baseURL: isDev() ? DevBaseUrl : ProdBaseUrl,
  plugins: [emailOTPClient(), deviceLinkClient()],
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: getToken,
    },
  },
});

export function useAuthApi() {
  const [data, setData] = useState<{ user: User; session: Session } | null>(
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
      if (data.session.token !== getToken()) {
        renewToken(data.session.token);
      }
    }
    if (error) {
      setError({ message: error.statusText });
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const renewToken = useCallback(
    (token: string) => {
      setToken(token);
      if (token) {
        refetch();
      } else {
        reset();
      }
    },
    [refetch, reset],
  );

  return {
    data,
    isLoading,
    error,
    refetch,
    authClient,
    renewToken,
    async logout() {
      await authClient.revokeSession({
        token: getToken(),
      });
      renewToken("");
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
      headers.append("Authorization", `Bearer ${getToken()}`);
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
    getToken(),
  );
  return eventSource;
}
