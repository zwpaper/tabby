import { createHonoAdapter } from "@queuedash/api";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { etag } from "hono/etag";
import { proxy } from "hono/proxy";
import { requireAuth } from "./auth";
import { backgroundJobQueues } from "./service/background-job";

export const internal = new Hono().use(
  requireAuth({
    internal: true,
  }),
);

internal.route(
  "/queuedash",
  createHonoAdapter({
    baseUrl: "/_internal/queuedash",
    ctx: {
      queues: backgroundJobQueues,
    },
  }),
);

internal.use(
  "/data-labeling-tool/*",
  etag(),
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

internal.all("/grafana/*", (c) => {
  const url = new URL(c.req.url);
  const path = url.href.replace(url.origin, "");
  return proxy(`http://grafana.railway.internal:3000/${path}`);
});

internal.all("/jaeger/*", (c) => {
  const url = new URL(c.req.url);
  const path = url.href.replace(url.origin, "");
  return proxy(`http://jaeger-query.railway.internal:16686/${path}`);
});
