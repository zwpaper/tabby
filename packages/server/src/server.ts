import { Hono } from "hono";
import { logger } from "hono/logger";
import chat from "./api/chat";
import models from "./api/models";
import usages from "./api/usages"; // Add this import
import { auth } from "./auth";

export const app = new Hono();
app.use(logger());

// static
if (process.env.NODE_ENV !== "test") {
  import("hono/bun").then(({ serveStatic }) => {
    app.use("/*", serveStatic({ root: "../website/dist" }));
  });
}

app.get("/health", (c) => c.text("OK"));

// Auth routes
app.on(["GET", "POST"], "/api/auth/**", (c) => auth.handler(c.req.raw));

const api = app.basePath("/api");

// Endpoint to list available models
const route = api
  .route("/models", models)
  .route("/chat", chat)
  .route("/usages", usages);

export type AppType = typeof route;

export default {
  port: process.env.PORT || 4111,
  fetch: app.fetch,
  idleTimeout: 60,
};
