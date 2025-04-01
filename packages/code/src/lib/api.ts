import type { AppType } from "@ragdoll/server";
import { useQuery } from "@tanstack/react-query";
import { hc } from "hono/client";
import { useAppConfig } from "./app-config";

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

function useApp() {
  const appConfig = useAppConfig();
  const app = hc<AppType>(appConfig.dev ? DevBaseUrl : ProdBaseUrl);
  return app;
}
