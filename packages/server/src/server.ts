import { SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { attachTransport, getLogger } from "@ragdoll/common";
import { app } from "./app";
import { startListenDBEvents } from "./db/events";
import { websocket } from "./lib/websocket";
import { startWorkers } from "./service/background-job";
export type { AppType } from "./app";

const loggerProvider = new LoggerProvider({
  processors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
});

attachTransport((args, meta) => {
  let severityNumber: SeverityNumber = 0;
  switch (meta.logLevelName) {
    case "SILLY":
      severityNumber = SeverityNumber.TRACE;
      break;
    case "TRACE":
      severityNumber = SeverityNumber.TRACE2;
      break;
    case "DEBUG":
      severityNumber = SeverityNumber.DEBUG;
      break;
    case "INFO":
      severityNumber = SeverityNumber.INFO;
      break;
    case "WARN":
      severityNumber = SeverityNumber.WARN;
      break;
    case "ERROR":
      severityNumber = SeverityNumber.ERROR;
      break;
    case "FATAL":
      severityNumber = SeverityNumber.FATAL;
      break;
    default:
      throw new Error(`Unknown log level: ${meta.logLevelName}`);
  }
  const body = typeof args[0] === "string" ? args[0] : JSON.stringify(args[0]);
  loggerProvider.getLogger(meta.name || "default").emit({
    body,
    severityNumber,
    attributes: {
      "log.file.name": meta.path?.fileName,
      "log.file.path": meta.path?.filePath,
    },
  });
});

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
});

const logger = getLogger("server");

sdk.start();

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

  await sdk.shutdown().catch(console.error);
  await loggerProvider.shutdown().catch(console.error);
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
