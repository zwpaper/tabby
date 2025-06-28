import type { ThreadAbortSignalSerialization } from "@quilted/threads";

export type {
  VSCodeHostApi,
  WebviewHostApi,
} from "./webview";

export { createVscodeHostStub } from "./webview-stub";

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

export interface WorkspaceState {
  chatInputSubmitHistory?: string[];
}

export interface TaskIdParams {
  uid: string;
}

export interface NewTaskParams {
  uid: undefined;
}

export interface ExecuteCommandResult {
  content: string;
  status: "idle" | "running" | "completed";
  isTruncated: boolean;
  error?: string; // Optional error message if the execution aborted / failed
}

export type TaskRunnerOptions = {
  model?: string;
  abortSignal?: ThreadAbortSignalSerialization;
};

const DevBaseUrl = "http://localhost:4113";
const ProdBaseUrl = "https://app.getpochi.com";

const isDev = process.env.POCHI_LOCAL_SERVER === "true";

export function getServerBaseUrl() {
  return isDev ? DevBaseUrl : ProdBaseUrl;
}
