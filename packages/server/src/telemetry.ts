import { SeverityNumber, logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { attachTransport } from "@ragdoll/common";

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
  logs.getLogger(meta.name || "default").emit({
    body,
    severityNumber,
    attributes: {
      "log.file.name": meta.path?.fileName,
      "log.file.path": meta.path?.filePath,
    },
  });
});

const sdk = new NodeSDK({
  logRecordProcessors: [new SimpleLogRecordProcessor(new OTLPLogExporter())],
  traceExporter: new OTLPTraceExporter(),
});

sdk.start();

process.on("SIGTERM SIGINT", () => sdk.shutdown().catch(console.error));
