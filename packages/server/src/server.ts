import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { app } from "./app";
import { startListenDBEvents } from "./db/events";
import { websocket } from "./lib/websocket";
import { startWorkers } from "./service/background-job";
export type { AppType } from "./app";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
});

sdk.start();

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
  // Stop accepting new connections
  server.stop();

  console.log("SIGINT / SIGTERM received, shutting down...");
  const pendingJobs = [...waitUntilPromises];
  console.log(`Waiting for ${pendingJobs.length} waitUntil promises...`);
  try {
    await Promise.all(pendingJobs);
  } catch (err) {
    console.warn("Error during graceful shutdown:", err);
  }
  console.log("All waitUntil promises resolved.");

  await sdk.shutdown();
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
