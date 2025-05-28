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
  prompt?: string;
  attachments?: NewTaskAttachment[];
}

export interface NewTaskAttachment {
  url: string;
  name?: string;
  contentType?: string;
}

export type CaptureEvent =
  | {
      event: "newTask";
      properties?: undefined;
    }
  | {
      event: "chatFinish";
      properties: {
        modelId: string | undefined;
        finishReason: string;
      };
    }
  | {
      event: "selectWorkflow";
      properties: {
        workflowId: string;
      };
    }
  | {
      event: "executeToolCall";
      properties: {
        toolName: string;
        durationMs: number;
        status: "success" | "error" | "aborted";
      };
    };

export interface ExecuteCommandResult {
  content: string;
  status: "idle" | "running" | "completed";
  isTruncated: boolean;
  error?: string; // Optional error message if the execution aborted / failed
}

const DevBaseUrl = "http://localhost:4113";
const ProdBaseUrl = "https://app.getpochi.com";

const isDev = process.env.POCHI_LOCAL_SERVER === "true";

export function getServerBaseUrl() {
  return isDev ? DevBaseUrl : ProdBaseUrl;
}
