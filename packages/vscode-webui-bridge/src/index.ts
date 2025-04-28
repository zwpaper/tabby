import type { ThreadAbortSignalSerialization } from "@quilted/threads";
import type { Environment } from "@ragdoll/server";

export interface VSCodeHostApi {
  getToken(): Promise<string | undefined>;
  setToken(token: string | undefined): Promise<void>;

  readEnvironment(): Promise<Environment>;

  executeToolCall(
    toolName: string,
    args: unknown,
    options: {
      toolCallId: string;
      abortSignal?: ThreadAbortSignalSerialization;
    },
  ): Promise<unknown>;
}

export interface WebviewHostApi {
  openTask(taskId: number): void;
}

const DevBaseUrl = "http://localhost:4113";
const ProdBaseUrl = "https://app.getpochi.com";

const isDev = false;

export function getServerBaseUrl() {
  return isDev ? DevBaseUrl : ProdBaseUrl;
}
