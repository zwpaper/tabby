export type { TaskEvent, UserEvent } from "@ragdoll/common";
import { WebSocket } from "ws";
export type * from "./types";
export type { AppType } from "./server";
export { deviceLinkClient } from "./lib/device-link/client";

export type { DBMessage } from "@ragdoll/common";
export type { auth } from "./auth";

export class PochiEventSource {
  private ws: WebSocket;

  constructor(baseUrl?: string, token?: string) {
    const url = `${baseUrl || ""}/api/events`;
    this.ws = new WebSocket(
      url,
      token
        ? {
            headers: {
              authorization: `Bearer ${token}`,
            },
          }
        : undefined,
    );
  }

  subscribe<T extends { type: string }>(
    type: string,
    listener: (data: T) => void,
  ) {
    const callback = (message: WebSocket.MessageEvent) => {
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

    this.ws.addEventListener("message", callback);

    return () => {
      this.ws.removeEventListener("message", callback);
    };
  }

  dispose() {
    this.ws.close();
  }
}
