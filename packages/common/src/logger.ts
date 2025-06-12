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

function stringToLogLevel(level: string) {
  switch (level) {
    case "silly":
      return 0;
    case "trace":
      return 1;
    case "debug":
      return 2;
    case "info":
      return 3;
    case "warn":
      return 4;
    case "error":
      return 5;
    case "fatal":
      return 6;
    default:
      return 3;
  }
}

function parseLogMinLevelAndType(name: string) {
  const config = process.env.POCHI_LOG || "";
  for (const item of config.split(",")) {
    const [key, value] = item.split("=");
    if (key === name) {
      return stringToLogLevel(value);
    }
  }

  if (name === "Pochi") {
    return 3;
  }
  return 4;
}

export function getLogger(name: string) {
  return mainLogger.getSubLogger({
    name,
    minLevel: parseLogMinLevelAndType(name),
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
