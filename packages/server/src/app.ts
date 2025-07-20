import { otel } from "@hono/otel";
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
import { queuedash } from "./queuedash";
import { slackService } from "./service/slack";

export const app = new Hono().use(authRequest);

if (process.env.NODE_ENV === "production") {
  app.use(otel());
} else {
  // Only use logger in development / testing.
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
export const route = api
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
