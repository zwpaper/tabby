import type { ThreadAbortSignalSerialization } from "@quilted/threads";
import type { Environment } from "@ragdoll/server";

export interface VSCodeHostApi {
  readResourceURI(): Promise<ResourceURI>;

  getToken(): Promise<string | undefined>;
  setToken(token: string | undefined): Promise<void>;

  readEnvironment(): Promise<Environment>;

  previewToolCall(
    toolName: string,
    args: unknown,
    options: {
      toolCallId: string;
    },
  ): Promise<void>;

  executeToolCall(
    toolName: string,
    args: unknown,
    options: {
      toolCallId: string;
      abortSignal: ThreadAbortSignalSerialization;
    },
  ): Promise<unknown>;

  listFilesInWorkspace(param: {
    query: string;
    limit?: number;
  }): Promise<string[]>;

  openFile(filePath: string, options?: { line?: number }): void;
}

export interface WebviewHostApi {
  /**
   * @param taskId Task id to open or "new" to create a new task.
   */
  openTask(taskId: number | "new"): void;

  openTaskList(): void;
}

const DevBaseUrl = "http://localhost:4113";
const ProdBaseUrl = "https://app.getpochi.com";

const isDev = false;

export function getServerBaseUrl() {
  return isDev ? DevBaseUrl : ProdBaseUrl;
}

export interface ResourceURI {
  logo128: string;
}
