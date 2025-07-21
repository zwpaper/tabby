import "./telemetry";

import { getLogger } from "@ragdoll/common";
import { app } from "./app";
import { startListenDBEvents } from "./db/events";
import { websocket } from "./lib/websocket";
import { startWorkers } from "./service/background-job";
export type { AppType } from "./app";

const logger = getLogger("server");

const server = Bun.serve({
  port: process.env.PORT || 4113,
  fetch: app.fetch,
  websocket,
});
logger.info(`Listening on http://localhost:${server.port} ...`);

const waitUntilPromises: Set<Promise<unknown>> = new Set();

export function waitUntil(promise: Promise<unknown>): void {
  const job = promise.finally(() => waitUntilPromises.delete(job));
  waitUntilPromises.add(job);
}

export function setIdleTimeout(request: Request, secs: number) {
  server.timeout(request, secs);
}

async function gracefulShutdown() {
  // Stop accepting new connections
  await server.stop().catch(console.error);

  logger.info("SIGINT / SIGTERM received, shutting down...");
  const pendingJobs = [...waitUntilPromises];
  logger.info(`Waiting for ${pendingJobs.length} waitUntil promises...`);
  try {
    await Promise.all(pendingJobs);
  } catch (err) {
    logger.warn("Error during graceful shutdown:", err);
  }
  logger.info("All waitUntil promises resolved.");

  logger.info("Shutdown complete, exiting...");
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
