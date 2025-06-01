import { type AppType, PochiEventSource } from "@ragdoll/server";
import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import { hc } from "hono/client";

export const apiClient = hc<AppType>(getServerBaseUrl(), {
  headers: {
    Authorization: `Bearer ${process.env.POCHI_SESSION_TOKEN}`,
  },
});

export const pochiEvents = new PochiEventSource(
  getServerBaseUrl(),
  process.env.POCHI_SESSION_TOKEN,
);
