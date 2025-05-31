export type {
  VSCodeHostApi,
  WebviewHostApi,
} from "./webview";

export type {
  McpStatus,
  McpConnection,
  McpTool,
  McpToolStatus,
} from "./mcp";

export type { CaptureEvent } from "./capture-event";

export interface ResourceURI {
  logo128: string;
}

export interface SessionState {
  lastVisitedRoute?: string | undefined;
  input?: string | undefined;
}

export interface TaskIdParams {
  taskId: number;
}

export interface NewTaskParams {
  taskId: "new";
}

export interface ExecuteCommandResult {
  content: string;
  status: "idle" | "running" | "completed";
  isTruncated: boolean;
  detach?: string;
  error?: string; // Optional error message if the execution aborted / failed
}

const DevBaseUrl = "http://localhost:4113";
const ProdBaseUrl = "https://app.getpochi.com";

const isDev = process.env.POCHI_LOCAL_SERVER === "true";

export function getServerBaseUrl() {
  return isDev ? DevBaseUrl : ProdBaseUrl;
}
