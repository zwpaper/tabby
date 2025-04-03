import type { AppType } from "@ragdoll/server";
import { useQuery } from "@tanstack/react-query";
import type { Session, User } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";
import { hc } from "hono/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppConfig } from "./app-config";
import Storage from "./storage";

const DevBaseUrl = "http://localhost:4111";
const ProdBaseUrl = "https://ragdoll-production.up.railway.app";

export function useModels() {
  const app = useApp();

  const query = useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const res = await app.api.models.$get();
      return await res.json();
    },
  });
  return query.data || [];
}

export function useChatStreamApi(): string {
  const app = useApp();
  return app.api.chat.stream.$url().toString();
}

const authStore = new Storage("authStore");

function setToken(token: string) {
  authStore.setItem("authToken", token);
}

function getToken() {
  return authStore.getItem("authToken") || "";
}

export function useAuthApi() {
  const appConfig = useAppConfig();
  const authClient = useMemo(
    () =>
      createAuthClient({
        baseURL: appConfig.dev ? DevBaseUrl : ProdBaseUrl,
        plugins: [magicLinkClient()],
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
  const [isLoading, setIsLoading] = useState(false);
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
    async sendMagicCode(email: string) {
      await authClient.signIn.magicLink({ email });
    },
    async loginWithMagicCode(_email: string, code: string) {
      const { data, error } = await authClient.magicLink.verify({
        query: {
          token: code,
        },
      });
      if (error) {
        throw new Error(error.statusText);
      }
      renewToken(data.token);
    },
    async logout() {
      renewToken("");
      await authClient.revokeSession({
        token: getToken(),
      });
    },
  };
}

function useApp() {
  const appConfig = useAppConfig();
  const app = hc<AppType>(appConfig.dev ? DevBaseUrl : ProdBaseUrl);
  return app;
}
