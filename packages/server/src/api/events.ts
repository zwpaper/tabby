import type { ServerWebSocket } from "bun";
import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { type User, requireAuth } from "../auth";

const { upgradeWebSocket, websocket } = createBunWebSocket();

const events = new Hono().get(
  "/",
  requireAuth(),
  upgradeWebSocket((c) => {
    const user = c.get("user") as User;
    user;
    return {
      onOpen(_, ws) {
        const raw = ws.raw as ServerWebSocket;
        raw;
      },
      onClose(_, ws) {
        const raw = ws.raw as ServerWebSocket;
        raw;
      },
    };
  }),
);

export default events;
export { websocket };
