import type { Job } from "bullmq";
import { type ILogObjMeta, Logger } from "tslog";

export function getJobLogger(job: Job) {
  const logger = new Logger({
    type: "hidden",
  });

  logger.attachTransport((logObj) => transport(job, logObj));

  return logger;
}

function transport(job: Job, logObj: ILogObjMeta) {
  const args = getArgs(logObj);
  const meta = logObj._meta;

  let message = toArgString(args[0]);
  if (meta.name) {
    message = `[${meta.name}] ${message}`;
  }

  const remainArgs = args.slice(1);
  if (remainArgs.length > 0) {
    message += ` ${remainArgs.map(toArgString).join(" ")}`;
  }

  job.log(`${meta.logLevelName}: ${message}`);
}

function getArgs(logObj: ILogObjMeta): unknown[] {
  const args = [];
  for (let i = 0; ; i++) {
    if (i in logObj) {
      args.push(logObj[i]);
    } else {
      break;
    }
  }
  return args;
}

function toArgString(arg: unknown): string {
  return typeof arg === "string" ? arg : JSON.stringify(arg);
}
