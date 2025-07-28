import "./telemetry";

import { getLogger } from "@ragdoll/common";
import { app } from "./app";
import { startListenDBEvents } from "./db/events";
import { startWorkers } from "./service/background-job";
export type { AppType } from "./app";
import { serve } from "@hono/node-server";

const logger = getLogger("Server");
const port = process.env.PORT ? Number.parseInt(process.env.PORT) : 4113;

const server = serve({
  port,
  fetch: app.fetch,
});
console.log(`Listening on http://localhost:${port} ...`); // ast-grep-ignore: no-console

const waitUntilPromises: Set<Promise<unknown>> = new Set();

export function waitUntil(promise: Promise<unknown>): void {
  const job = promise.finally(() => waitUntilPromises.delete(job));
  waitUntilPromises.add(job);
}

export function setIdleTimeout(_request: Request, _secs: number) {
  // server.timeout(request, secs);
}

async function gracefulShutdown() {
  await new Promise((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve(null))),
  ).catch((err) => logger.error("Error closing server", err));

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
  logger.error("Uncaught Exception", err);
  process.exit(1);
});

startWorkers();
startListenDBEvents();
