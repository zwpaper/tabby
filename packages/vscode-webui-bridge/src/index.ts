import type { ThreadAbortSignalSerialization } from "@quilted/threads";
import type { ThreadSignalSerialization } from "@quilted/threads/signals";
import type { Environment } from "@ragdoll/server";

export interface VSCodeHostApi {
  readResourceURI(): Promise<ResourceURI>;

  readToken(): Promise<ThreadSignalSerialization<string | undefined>>;

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
  ): Promise<
    | {
        error: string;
      }
    | undefined
  >;

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
   * Get active tabs with real-time updates via ThreadSignal
   * Each tab is represented by an object with:
   * - filepath: Path to the file
   *   - For files within workspace: Returns path relative to workspace root (e.g., "src/index.ts")
   *   - For files outside workspace: Returns the absolute file path unchanged (e.g., "/Users/name/project/file.ts")
   * - isDir: Boolean indicating if the item is a directory
   *
   */
  readActiveTabs(): Promise<
    ThreadSignalSerialization<Array<{ filepath: string; isDir: boolean }>>
  >;

  /**
   * Opens a file at the specified file path.
   *
   * @param filePath - The path to the file to be opened.
   * @param options - Optional parameters for opening the file.
   * @param options.start - The starting line number (1-based) to open the file at.
   * @param options.end - The ending line number (1-based) to open the file at.
   * @param options.preserveFocus - If true, the file will be opened without changing focus. Only applicable for text files.
   */
  openFile(
    filePath: string,
    options?: { start?: number; end?: number; preserveFocus?: boolean },
  ): void;

  readCurrentWorkspace(): Promise<string | undefined>;

  /**
   * @param event - The event name.
   * @param properties - The event properties.
   */
  capture(e: CaptureEvent): Promise<void>;
}

export interface WebviewHostApi {
  /**
   * @param params - Existing task id or new task params.
   */
  openTask(params: TaskIdParams | NewTaskParams): void;

  openTaskList(): void;

  openSettings(): void;

  onAuthChanged(): void;
}

const DevBaseUrl = "http://localhost:4113";
const ProdBaseUrl = "https://app.getpochi.com";

const isDev = process.env.POCHI_LOCAL_SERVER === "true";

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

export type CaptureEvent =
  | {
      event: "newTask";
      properties?: undefined;
    }
  | {
      event: "addToolResult";
      properties: {
        toolName: string;
      };
    };
