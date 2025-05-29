import { Thread } from "@quilted/threads";
import type {
  VSCodeHostApi,
  WebviewHostApi,
} from "@ragdoll/vscode-webui-bridge";
import type { WebviewApi } from "vscode-webview";
import { queryClient } from "./query-client";

let vscodeApi: WebviewApi<unknown> | undefined = undefined;

function getVSCodeApi() {
  if (vscodeApi) {
    return vscodeApi;
  }
  try {
    vscodeApi = acquireVsCodeApi();
  } catch (error) {
    console.warn(
      "Failed to acquire VSCode API. This is likely due to running in a non-VSCode environment.",
      error,
    );
  }
  return vscodeApi;
}

function createVSCodeHost(): VSCodeHostApi {
  const vscode = getVSCodeApi();
  const thread = new Thread<VSCodeHostApi, WebviewHostApi>(
    {
      send(message) {
        return vscode?.postMessage(message);
      },
      listen(listen, { signal }) {
        self.addEventListener(
          "message",
          (event) => {
            listen(event.data);
          },
          { signal },
        );
      },
    },
    {
      imports: [
        "readToken",
        "getSessionState",
        "setSessionState",
        "readEnvironment",
        "executeToolCall",
        "listFilesInWorkspace",
        "readActiveTabs",
        "readActiveSelection",
        "readCurrentWorkspace",
        "previewToolCall",
        "openFile",
        "readResourceURI",
        "listWorkflowsInWorkspace",
        "capture",
        "closeCurrentWorkspace",
        "readMcpStatus",
      ],
      exports: {
        openTask(params) {
          window.router.navigate({
            to: "/",
            search: {
              taskId: params.taskId,
              ts: Date.now(),
            },
            replace: true,
          });
        },

        openTaskList() {
          window.router.navigate({
            to: "/tasks",
            replace: true,
          });
        },

        openSettings() {
          window.router.navigate({
            to: "/settings",
            replace: true,
          });
        },

        onAuthChanged() {
          queryClient.resetQueries();
        },
      },
    },
  );

  return thread.imports;
}

export const vscodeHost = createVSCodeHost();
