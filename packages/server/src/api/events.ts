import type { ServerWebSocket } from "bun";
import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { type User, requireAuth } from "../auth";
import { getTaskEventChannel, getUserEventChannel } from "../server";

const { upgradeWebSocket, websocket } = createBunWebSocket();

const events = new Hono().get(
  "/",
  requireAuth(),
  upgradeWebSocket((c) => {
    const user = c.get("user") as User;
    const userChannel = getUserEventChannel(user.id);
    const taskChannel = getTaskEventChannel(user.id);
    return {
      onOpen(_, ws) {
        const raw = ws.raw as ServerWebSocket;
        raw.subscribe(userChannel);
        raw.subscribe(taskChannel);
      },
      onClose(_, ws) {
        const raw = ws.raw as ServerWebSocket;
        raw.unsubscribe(userChannel);
        raw.unsubscribe(taskChannel);
      },
    };
  }),
);

export default events;
export { websocket };
