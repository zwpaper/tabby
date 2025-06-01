import { type ILogObjMeta, type IMeta, Logger } from "tslog";

const mainLogger = new Logger({
  type: "hidden",
});

export function getLogger(name: string) {
  return mainLogger.getSubLogger({
    name,
  });
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

export function attachTransport(
  transport: (args: unknown[], meta: IMeta) => void,
) {
  mainLogger.attachTransport((logObj) => {
    transport(getArgs(logObj), logObj._meta);
  });
}
