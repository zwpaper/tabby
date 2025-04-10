export type * from "./types";
export type { AppType } from "./server";
export { deviceLinkClient } from "./lib/device-link/client";

export interface UserEvent {
  type: string;
  payload: unknown;
}

export class UserEventSource {
  private ws = new WebSocket("/api/events");

  subscribe(type: string, listener: (e: UserEvent) => void) {
    this.ws.addEventListener("message", (message) => {
      if (typeof message.data !== "string") return;
      const data = JSON.parse(message.data);
      if (
        data.type === type ||
        type === "*" ||
        (type.endsWith("*") && data.type.startsWith(type.slice(0, -1)))
      ) {
        listener(data.data);
      }
    });
  }

  dispose() {
    this.ws.close();
  }
}
