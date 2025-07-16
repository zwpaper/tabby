import "./lib/laminar";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { etag } from "hono/etag";
import { logger } from "hono/logger";
import admin from "./api/admin";
import billing from "./api/billing";
import chat from "./api/chat";
import code from "./api/code";
import enhance from "./api/enhance";
import events from "./api/events";
import integrations from "./api/integrations";
import minions from "./api/minions";
import models from "./api/models";
import tasks from "./api/tasks";
import tools from "./api/tools";
import upload from "./api/upload";
import usages from "./api/usages";
import { authRequest, requireAuth } from "./auth";
import { auth } from "./better-auth";
import { startListenDBEvents } from "./db/events";
import { websocket } from "./lib/websocket";
import { queuedash } from "./queuedash";
import { startWorkers } from "./service/background-job";
import { slackService } from "./service/slack";

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

    app.use(
      "/_internal/data-labeling-tool/*",
      etag(),
      requireAuth({ internal: true }),
      serveStatic({
        root: "../model/dist",
        rewriteRequestPath: (path) =>
          path.replace(/^\/_internal\/data-labeling-tool/, ""),
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

    // Serve website static files
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
          hostname.endsWith(".vscode-cdn.net") ||
          hostname === "vscode.ikw.app" ||
          hostname.endsWith(".runpochi.com") ||
          hostname.endsWith(".fly.dev")
        ) {
          return origin;
        }
      } catch (err) {
        // Ignore invalid origin
      }

      return undefined;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "PATCH", "OPTIONS", "DELETE"],
    credentials: true,
  }),
);

// Auth routes
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// queue dash.
app.route("/queuedash", queuedash);

const api = app.basePath("/api");

// Endpoint to list available models
const route = api
  .route("/events", events)
  .route("/models", models)
  .route("/chat", chat)
  .route("/code", code)
  .route("/usages", usages)
  .route("/billing", billing)
  .route("/tasks", tasks)
  .route("/minions", minions)
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

const waitUntilPromises: Set<Promise<unknown>> = new Set();

export function waitUntil(promise: Promise<unknown>): void {
  const job = promise.finally(() => waitUntilPromises.delete(job));
  waitUntilPromises.add(job);
}

export function setIdleTimeout(request: Request, secs: number) {
  server.timeout(request, secs);
}

async function gracefulShutdown() {
  console.log("SIGINT / SIGTERM received, shutting down...");
  const pendingJobs = [...waitUntilPromises];
  console.log(`Waiting for ${pendingJobs.length} waitUntil promises...`);
  try {
    await Promise.all(pendingJobs);
  } catch (err) {
    console.warn("Error during graceful shutdown:", err);
  }
  console.log("All waitUntil promises resolved.");

  console.log("Shutdown complete, exiting...");
  process.exit(143);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  console.error("Stack trace:", err.stack);
});

startWorkers();
startListenDBEvents();
