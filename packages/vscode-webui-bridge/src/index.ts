import type { ThreadAbortSignalSerialization } from "@quilted/threads";
import type { ThreadSignalSerialization } from "@quilted/threads/signals";
import type { Environment } from "@ragdoll/server";

export interface VSCodeHostApi {
  readResourceURI(): Promise<ResourceURI>;

  getToken(): Promise<string | undefined>;
  setToken(token: string | undefined): Promise<void>;

  getSessionState<K extends keyof SessionState>(
    keys?: K[],
  ): Promise<Pick<SessionState, K>>;
  setSessionState(state: Partial<SessionState>): Promise<void>;

  readEnvironment(): Promise<Environment>;

  previewToolCall(
    toolName: string,
    args: unknown,
    options: {
      toolCallId: string;
      state: "partial-call" | "call" | "result";
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

  listFilesInWorkspace(): Promise<
    {
      filepath: string;
      isDir: boolean;
    }[]
  >;

  /**
   * Opens a file at the specified file path.
   *
   * @param filePath - The path to the file to be opened.
   * @param options - Optional parameters for opening the file.
   * @param options.start - The starting line number (1-based) to open the file at.
   * @param options.end - The ending line number (1-based) to open the file at.
   */
  openFile(filePath: string, options?: { start?: number; end?: number }): void;

  readIsDevMode(): Promise<ThreadSignalSerialization<boolean>>;
}

export interface WebviewHostApi {
  /**
   * @param params - Existing task id or new task params.
   */
  openTask(params: TaskIdParams | NewTaskParams): void;

  openTaskList(): void;

  onAuthChanged(): void;
}

const DevBaseUrl = "http://localhost:4113";
const ProdBaseUrl = "https://app.getpochi.com";

const isDev = true;

export function getServerBaseUrl() {
  return isDev ? DevBaseUrl : ProdBaseUrl;
}

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
