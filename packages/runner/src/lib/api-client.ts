import { type AppType, PochiEventSource } from "@ragdoll/server";
import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import { hc } from "hono/client";

export const apiClient = hc<AppType>(getServerBaseUrl(), {
  fetch: async (input: RequestInfo | URL, requestInit?: RequestInit) => {
    const headers = new Headers(requestInit?.headers);
    headers.append(
      "Authorization",
      `Bearer ${process.env.POCHI_SESSION_TOKEN}`,
    );
    return fetch(input, {
      ...requestInit,
      headers,
    });
  },
});

export const pochiEvents = new PochiEventSource(
  getServerBaseUrl(),
  process.env.POCHI_SESSION_TOKEN,
);
