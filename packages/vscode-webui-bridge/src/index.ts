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

export type GitDiff = {
  relative: string;
  absolute: string;
  before: string;
  after: string;
};
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

export type RunTaskOptions = {
  model?: string;
  abortSignal?: ThreadAbortSignalSerialization;
};

export type SaveCheckpointOptions = {
  /**
   * By default, will only save checkpoint if there are changes, but if you want to force a save, set this to true
   */
  force?: boolean;
};

/**
 * Custom model setting
 */
export type CustomModelSetting = {
  models: {
    /**
     * Display name of the model, e.g., "GPT-4o".
     * This is used for display purposes in the UI. If not provided, the `id` will be used.
     */
    name?: string;
    /**
     * Identifier for the model, e.g., "gpt-4o".
     * This is used to identify the model in API requests.
     */
    id: string;
    /**
     * Maximum number of generated tokens for the model
     */
    maxTokens: number;
    /**
     * Context window size for the model
     */
    contextWindow: number;
  }[];
  baseURL: string;
  apiKey?: string;
};

const DevBaseUrl = "http://localhost:4113";
const ProdBaseUrl = "https://app.getpochi.com";

export const isDev = process.env.POCHI_LOCAL_SERVER === "true";

export function getServerBaseUrl() {
  return isDev ? DevBaseUrl : ProdBaseUrl;
}
