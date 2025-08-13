import { otel } from "@hono/otel";
import { getLogger } from "@ragdoll/common";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { etag } from "hono/etag";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import admin from "./api/admin";
import billing from "./api/billing";
import chat from "./api/chat";
import chatNext from "./api/chat-next";
import clips from "./api/clips";
import code from "./api/code";
import enhance from "./api/enhance";
import integrations from "./api/integrations";
import invitation from "./api/invitation";
import live from "./api/live";
import minions from "./api/minions";
import models from "./api/models";
import tasks from "./api/tasks";
import tools from "./api/tools";
import upload from "./api/upload";
import usages from "./api/usages";
import { authRequest } from "./auth";
import { auth } from "./better-auth";
import { queuedash } from "./queuedash";
import { slackService } from "./service/slack";

const log = getLogger("HonoHandler");

export const app = new Hono();

// Add global error handler
app.onError((error, c) => {
  const method = c.req.method;
  const path = c.req.path;
  const userAgent = c.req.header("User-Agent") || "unknown";

  if (error instanceof HTTPException) {
    if (error.status >= 500) {
      log.error("HTTP Exception", {
        status: error.status,
        message: error.message,
        method,
        path,
        userAgent,
      });
    }
  } else {
    // Log all other errors as error level
    // FIXME(wei): Should alert and fix these unknown error when occurred
    log.error("Unhandled Error", {
      error: error.message,
      stack: error.stack,
      method,
      path,
      userAgent,
    });
  }

  // Re-throw to let Hono handle the response
  throw error;
});

if (process.env.NODE_ENV === "production") {
  app.use(otel());
} else {
  // Only use logger in development / testing.
  app.use(logger());
}

// after otel so user info is traced.
app.use(authRequest);

// Static file serving with dynamic import
if (process.env.NODE_ENV !== "test") {
  (async () => {
    const { serveStatic } = await import("@hono/node-server/serve-static");
    const { readFile } = await import("node:fs/promises");

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
          hostname.endsWith(".fly.dev") ||
          hostname.startsWith("localhost")
        ) {
          return origin;
        }
      } catch (err) {
        // Ignore invalid origin
      }

      return undefined;
    },
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Pochi-Extension-Version",
    ],
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
  .route("/models", models)
  .route("/chat", chat)
  .route("/chatNext", chatNext)
  .route("/code", code)
  .route("/usages", usages)
  .route("/billing", billing)
  .route("/tasks", tasks)
  .route("/minions", minions)
  .route("/integrations", integrations)
  .route("/invitation", invitation)
  .route("/upload", upload)
  .route("/enhancePrompt", enhance)
  .route("/tools", tools)
  .route("/clips", clips)
  .route("/admin", admin)
  .route("/live", live);

export type AppType = typeof route;
