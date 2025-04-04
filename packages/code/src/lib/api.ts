import { type AppType, deviceLinkClient } from "@ragdoll/server";
import type { Session, User } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { hc } from "hono/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppConfig } from "./app-config";
import { authStorage } from "./storage";

const DevBaseUrl = "http://localhost:4111";
const ProdBaseUrl = "https://ragdoll-production.up.railway.app";

function setToken(token: string) {
  authStorage.setItem("authToken", token);
}

function getToken() {
  return authStorage.getItem("authToken") || "";
}

export function useAuthApi() {
  const appConfig = useAppConfig();
  const authClient = useMemo(
    () =>
      createAuthClient({
        baseURL: appConfig.dev ? DevBaseUrl : ProdBaseUrl,
        plugins: [emailOTPClient(), deviceLinkClient()],
        fetchOptions: {
          auth: {
            type: "Bearer",
            token: getToken,
          },
        },
      }),
    [appConfig],
  );
  const [data, setData] = useState<{ user: User; session: Session } | null>(
    null,
  );
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
  }, [authClient]);

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
      renewToken("");
      await authClient.revokeSession({
        token: getToken(),
      });
    },
  };
}

export function useApiClient() {
  const appConfig = useAppConfig();
  const app = hc<AppType>(appConfig.dev ? DevBaseUrl : ProdBaseUrl, {
    fetch: (input: RequestInfo | URL, requestInit?: RequestInit) => {
      return fetch(input, {
        ...requestInit,
        headers: {
          ...requestInit?.headers,
          Authorization: `Bearer ${getToken()}`,
        },
      });
    },
  });
  return app;
}
