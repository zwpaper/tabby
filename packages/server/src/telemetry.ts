import { trace } from "@opentelemetry/api";
import { SeverityNumber, logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { attachTransport } from "@ragdoll/common";

const logAsEvent = true;

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
  const eventName = `log.${meta.name || "default"}`;
  const location = meta.path?.filePathWithLine;
  const { logLevelName: logLevel } = meta;
  if (logAsEvent) {
    span?.addEvent(
      eventName,
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
});

sdk.start();

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => sdk.shutdown().catch(console.error));
}
