import { type ILogObjMeta, type IMeta, Logger } from "tslog";

const isVSCodeEnvironment = () => {
  if (typeof process !== "undefined") {
    return !!process.env.VSCODE_PID;
  }

  return false;
};

const mainLogger = new Logger({
  type: isVSCodeEnvironment() ? "hidden" : "pretty",
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
