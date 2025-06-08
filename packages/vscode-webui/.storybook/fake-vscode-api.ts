import { Thread, type ThreadAbortSignalSerialization } from "@quilted/threads";
import type { ThreadSignalSerialization } from "@quilted/threads/signals";
import type { Environment } from "@ragdoll/common";
import type {
  CaptureEvent,
  McpStatus,
  ResourceURI,
  SessionState,
  TaskRunnerState,
  VSCodeHostApi,
  WebviewHostApi,
} from "@ragdoll/vscode-webui-bridge";
import Emittery from "emittery";

const channel = new Emittery();

// @ts-ignore
window.acquireVsCodeApi = () => {
  return {
    postMessage: (message: unknown) => {
      channel.emit("message", message);
    },
  };
};

const thread = new Thread<WebviewHostApi, VSCodeHostApi>(
  {
    send(message) {
      window.dispatchEvent(new MessageEvent("message", { data: message }));
    },
    listen(listener) {
      channel.on("message", listener);
    },
  },
  {
    exports: {
      readCurrentWorkspace: async () => {
        return "/";
      },
      readResourceURI: (): Promise<ResourceURI> => {
        return Promise.resolve({} as ResourceURI);
      },
      readToken: (): Promise<ThreadSignalSerialization<string | undefined>> => {
        return Promise.resolve(
          {} as ThreadSignalSerialization<string | undefined>,
        );
      },
      getSessionState: <K extends keyof SessionState>(
        keys?: K[],
      ): Promise<Pick<SessionState, K>> => {
        return Promise.resolve({} as Pick<SessionState, K>);
      },
      setSessionState: (state: Partial<SessionState>): Promise<void> => {
        return Promise.resolve();
      },
      readEnvironment: (): Promise<Environment> => {
        return Promise.resolve({} as Environment);
      },
      previewToolCall: (
        toolName: string,
        args: unknown,
        options: {
          toolCallId: string;
          state: "partial-call" | "call" | "result";
        },
      ): Promise<{ error: string } | undefined> => {
        return Promise.resolve(undefined);
      },
      executeToolCall: (
        toolName: string,
        args: unknown,
        options: {
          toolCallId: string;
          abortSignal: ThreadAbortSignalSerialization;
        },
      ): Promise<unknown> => {
        return Promise.resolve(undefined);
      },
      listFilesInWorkspace: (): Promise<
        { filepath: string; isDir: boolean }[]
      > => {
        return Promise.resolve([{ filepath: "test", isDir: false }]);
      },
      listWorkflowsInWorkspace: (): Promise<
        { id: string; path: string; content: string }[]
      > => {
        return Promise.resolve([]);
      },
      readActiveTabs: (): Promise<
        ThreadSignalSerialization<Array<{ filepath: string; isDir: boolean }>>
      > => {
        return Promise.resolve(
          {} as ThreadSignalSerialization<
            Array<{ filepath: string; isDir: boolean }>
          >,
        );
      },
      readActiveSelection: (): Promise<
        ThreadSignalSerialization<
          Environment["workspace"]["activeSelection"] | undefined
        >
      > => {
        return Promise.resolve(
          {} as ThreadSignalSerialization<
            Environment["workspace"]["activeSelection"] | undefined
          >,
        );
      },
      openFile: (
        filePath: string,
        options?: { start?: number; end?: number; preserveFocus?: boolean },
      ): void => {},
      capture: (e: CaptureEvent): Promise<void> => {
        return Promise.resolve();
      },
      closeCurrentWorkspace: (): void => {},
      readMcpStatus: (): Promise<ThreadSignalSerialization<McpStatus>> => {
        return Promise.resolve({} as ThreadSignalSerialization<McpStatus>);
      },
      fetchThirdPartyRules: (): Promise<{
        rulePaths: string[];
        workspaceRuleExists: boolean;
        copyRules: () => Promise<void>;
      }> => {
        return Promise.resolve({
          rulePaths: [],
          workspaceRuleExists: false,
          copyRules: () => Promise.resolve(),
        });
      },
      openExternal: (uri: string): Promise<void> => {
        return Promise.resolve();
      },
      runTask: (taskId: number): Promise<void> => {
        return Promise.resolve();
      },
      readTaskRunners: (): Promise<
        ThreadSignalSerialization<{ [taskId: number]: TaskRunnerState }>
      > => {
        return Promise.resolve(
          {} as ThreadSignalSerialization<{
            [taskId: number]: TaskRunnerState;
          }>,
        );
      },
    },
  },
);
