import "./lib/laminar";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { etag } from "hono/etag";
import { logger } from "hono/logger";
import type { UserEvent } from ".";
import admin from "./api/admin";
import billing from "./api/billing";
import chat from "./api/chat";
import enhance from "./api/enhance";
import events, { websocket } from "./api/events";
import integrations from "./api/integrations";
import models from "./api/models";
import tasks from "./api/tasks";
import tools from "./api/tools";
import upload from "./api/upload";
import usages from "./api/usages";
import { auth, authRequest } from "./auth";
import { slackService } from "./service/slack";
import { taskService } from "./service/task";

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

    app.use(
      "/*",
      etag(),
      serveStatic({
        root: "../website/dist",
        precompressed: true,
        onFound: (path, c) => {
          if (path.endsWith(".html") || path.endsWith("manifest.json")) {
            c.header("Cache-Control", "public, max-age=0, must-revalidate");
          } else {
            c.header("Cache-Control", "public, immutable, max-age=31536000");
          }
        },
      }),
    );
    app.get("*", (c) => c.html(html));
  })();
}

app.get("/health", (c) => c.text("OK"));

app.on(["GET", "POST"], "/slack/*", (c) => slackService.handler(c.req.raw));

app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      if (origin.startsWith("vscode-webview://")) {
        return origin;
      }

      // Allow hosts for cloud based vscode workers
      try {
        const requestOriginUrl = new URL(origin);
        const hostname = requestOriginUrl.hostname;
        if (
          hostname === "vscode-cdn.net" ||
          hostname.endsWith(".vscode-cdn.net")
        ) {
          return origin;
        }
      } finally {
        // noop
      }

      return undefined;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    credentials: true,
  }),
);

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
  .route("/tasks", tasks)
  .route("/integrations", integrations)
  .route("/upload", upload)
  .route("/enhancePrompt", enhance)
  .route("/tools", tools)
  .route("/admin", admin);

export type AppType = typeof route;

const server = Bun.serve({
  port: process.env.PORT || 4113,
  fetch: app.fetch,
  websocket,
});
console.log(`Listening on http://localhost:${server.port} ...`);

export function getUserEventChannel(userId: string) {
  return `user-events:${userId}`;
}

export function publishUserEvent(userId: string, event: UserEvent) {
  server.publish(getUserEventChannel(userId), JSON.stringify(event));
}

export function after(_promise: Promise<unknown>): void {}

export function setIdleTimeout(request: Request, secs: number) {
  server.timeout(request, secs);
}

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down...");
  await taskService.gracefulShutdown();

  console.log("Shutdown complete, exiting...");
  process.exit(143);
});
