import type { ServerWebSocket } from "bun";
import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { type User, requireAuth } from "../auth";
import { getUserEventChannel } from "../server";

const { upgradeWebSocket, websocket } = createBunWebSocket();

const events = new Hono().get(
  "/",
  requireAuth,
  upgradeWebSocket((c) => {
    const user = c.get("user") as User;
    const channel = getUserEventChannel(user.id);
    return {
      onOpen(_, ws) {
        const raw = ws.raw as ServerWebSocket;
        raw.subscribe(channel);
      },
      onClose(_, ws) {
        const raw = ws.raw as ServerWebSocket;
        raw.unsubscribe(channel);
      },
    };
  }),
);

export default events;
export { websocket };
