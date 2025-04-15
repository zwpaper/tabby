import { Hono } from "hono";
import { logger } from "hono/logger";
import type { UserEvent } from ".";
import billing from "./api/billing";
import chat from "./api/chat";
import events, { websocket } from "./api/events";
import models from "./api/models";
import tasks from "./api/tasks";
import usages from "./api/usages";
import { auth, authRequest } from "./auth";
import slack from "./slack";

export const app = new Hono().use(authRequest);

// Only use logger in development / testing.
if (process.env.NODE_ENV !== "production") {
  app.use(logger());
}

// Static file serving with dynamic import
if (process.env.NODE_ENV !== "test") {
  (async () => {
    const { serveStatic } = await import("hono/bun");
    const { readFile } = await import("node:fs/promises");
    const html = await readFile("../website/dist/index.html", "utf-8");

    app.use("/*", serveStatic({ root: "../website/dist" }));
    app.get("*", (c) => c.html(html));
  })();
}

app.get("/health", (c) => c.text("OK"));

app.on(["GET", "POST"], "/slack/*", (c) => slack.handler(c.req.raw));

// Auth routes
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

const api = app.basePath("/api");

// Endpoint to list available models
const route = api
  .route("/events", events)
  .route("/models", models)
  .route("/chat", chat)
  .route("/usages", usages)
  .route("/billing", billing)
  .route("/tasks", tasks);

export type AppType = typeof route;

const server = Bun.serve({
  port: process.env.PORT || 4113,
  fetch: app.fetch,
  idleTimeout: 255,
  websocket,
});

export function getUserEventChannel(userId: string) {
  return `user-events:${userId}`;
}

export function publishUserEvent(userId: string, event: UserEvent) {
  server.publish(getUserEventChannel(userId), JSON.stringify(event));
}
