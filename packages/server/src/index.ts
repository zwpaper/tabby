export type { TaskEvent, TaskCreateEvent } from "@ragdoll/db";
import { EventSource } from "eventsource";
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
  return new PochiEventSourceImpl(uid, baseUrl, token);
}

class PochiEventSourceImpl implements PochiEventSource {
  private es: EventSource;

  constructor(uid: string, baseUrl?: string, token?: string) {
    const url = `${baseUrl || ""}/api/tasks/${uid}/events`;
    this.es = new EventSource(url, {
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

export const ReachedCreditLimitErrorMessage = "REACHED_CREDIT_LIMIT";
