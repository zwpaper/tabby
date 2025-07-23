export type { TaskEvent, TaskCreateEvent } from "@ragdoll/db";
import { EventSource, type EventSourceInit } from "eventsource";
import type { hc } from "hono/client";
import type { AppType } from "./server";
export type * from "./types";
export type { AppType } from "./server";
export { deviceLinkClient } from "./lib/device-link/client";

export type { auth } from "./better-auth";

export interface PochiEventSource {
  /* Subscribe to events, returns a function to unsubscribe */
  subscribe<T extends { type: string }>(
    type: string,
    listener: (data: T) => void,
  ): () => void;
  dispose(): void;
}

export function createPochiEventSource(
  uid: string,
  baseUrl?: string,
  token?: string,
) {
  const url = `${baseUrl || ""}/api/tasks/${uid}/events`;
  return new PochiEventSourceImpl(url, {
    fetch: token
      ? (input, init) =>
          fetch(input, {
            ...init,
            headers: {
              ...init.headers,
              Authorization: `Bearer ${token}`,
            },
          })
      : undefined,
  });
}

export function createPochiEventSourceWithApiClient(
  uid: string,
  apiClient: ReturnType<typeof hc<AppType>>,
) {
  const url = apiClient.api.tasks[":uid"].events
    .$url({ param: { uid } })
    .toString();
  return new PochiEventSourceImpl(url, {
    fetch: (input, init) => {
      if (
        (typeof input === "string" && input !== url) ||
        (input instanceof URL && input.toString() !== url)
      ) {
        throw new Error(
          `Expected input to be ${url}, but got ${input}. This is likely a bug in PochiEventSourceImpl.`,
        );
      }
      const { headers, ...restInit } = init;
      return apiClient.api.tasks[":uid"].events.$get(
        {
          param: { uid },
        },
        {
          headers,
          init: restInit,
        },
      );
    },
  });
}

class PochiEventSourceImpl implements PochiEventSource {
  private es: EventSource;

  constructor(url: string, eventSourceInitDict: EventSourceInit) {
    this.es = new EventSource(url, eventSourceInitDict);
  }

  subscribe<T extends { type: string }>(
    type: string,
    listener: (data: T) => void,
  ) {
    const callback = (message: MessageEvent) => {
      try {
        if (typeof message.data !== "string") return;
        const data = JSON.parse(message.data) as T;

        if (
          data.type === type ||
          type === "*" ||
          (type.endsWith("*") && data.type.startsWith(type.slice(0, -1)))
        ) {
          listener(data);
        }
      } catch (error) {
        console.error(`Error processing ${type} event:`, error);
      }
    };

    this.es.addEventListener("message", callback);

    return () => {
      this.es.removeEventListener("message", callback);
    };
  }

  dispose() {
    this.es.close();
  }
}

export const ServerErrors = {
  RequireSubscription: "REQUIRE_SUBSCRIPTION",
  RequireOrgSubscription: "REQUIRE_ORG_SUBSCRIPTION",
  ReachedCreditLimit: "REACHED_CREDIT_LIMIT",
  ReachedOrgCreditLimit: "REACHED_ORG_CREDIT_LIMIT",
  RequirePayment: "REQUIRE_PAYMENT",
  RequireOrgPayment: "REQUIRE_ORG_PAYMENT",
  RequireGithubIntegration: "REQUIRE_GITHUB_INTEGRATION",
};
