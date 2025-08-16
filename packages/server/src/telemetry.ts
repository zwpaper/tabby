import { attachTransport } from "@getpochi/common";
import { trace } from "@opentelemetry/api";
import { SeverityNumber, logs } from "@opentelemetry/api-logs";
import {
  getNodeAutoInstrumentations,
  getResourceDetectors,
} from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";

const logAsEvent = false;

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
  const body = args
    .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
    .join(" ");
  const span = trace.getActiveSpan();
  const eventName = meta.name || "default";
  const location = meta.path?.filePathWithLine;
  const { logLevelName: logLevel } = meta;
  if (logAsEvent) {
    span?.addEvent(
      "ragdoll.log",
      {
        message: body,
        logLevel,
        location,
      },
      meta.date,
    );
  } else {
    logs.getLogger(eventName).emit({
      body,
      severityNumber,
      timestamp: meta.date,
      attributes: {
        location,
        logLevel,
      },
    });
  }
});

const sdk = new NodeSDK({
  logRecordProcessors: [new SimpleLogRecordProcessor(new OTLPLogExporter())],
  traceExporter: new OTLPTraceExporter(),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  resourceDetectors: getResourceDetectors(),
});

sdk.start();

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => sdk.shutdown().catch(console.error)); // ast-grep-ignore: no-console
}
