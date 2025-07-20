import { createHonoAdapter } from "@queuedash/api";
import { Hono } from "hono";
import { requireAuth } from "./auth";
import { backgroundJobQueues } from "./service/background-job";

export const queuedash = new Hono().use(
  requireAuth({
    internal: true,
  }),
);

queuedash.route(
  "/",
  createHonoAdapter({
    baseUrl: "/queuedash",
    ctx: {
      queues: backgroundJobQueues,
    },
  }),
);
