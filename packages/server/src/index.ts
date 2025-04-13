import { WebSocket } from "ws";
export type * from "./types";
export type { AppType } from "./server";
export { deviceLinkClient } from "./lib/device-link/client";

export interface UserEvent {
  type: string;
  data: unknown;
}

export class UserEventSource {
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

  subscribe(type: string, listener: (e: UserEvent) => void) {
    this.ws.addEventListener("message", (message) => {
      if (typeof message.data !== "string") return;
      const data = JSON.parse(message.data) as UserEvent;
      if (
        data.type === type ||
        type === "*" ||
        (type.endsWith("*") && data.type.startsWith(type.slice(0, -1)))
      ) {
        listener(data);
      }
    });
  }

  dispose() {
    this.ws.close();
  }
}
