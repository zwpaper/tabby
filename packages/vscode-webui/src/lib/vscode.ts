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
  vscodeApi = acquireVsCodeApi();
  return vscodeApi;
}

function createVSCodeHost(): VSCodeHostApi {
  const vscode = getVSCodeApi();
  const thread = new Thread<VSCodeHostApi, WebviewHostApi>(
    {
      send(message) {
        return vscode.postMessage(message);
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
        "getToken",
        "setToken",
        "getSessionState",
        "setSessionState",
        "readEnvironment",
        "executeToolCall",
        "listFilesInWorkspace",
        "previewToolCall",
        "openFile",
        "readResourceURI",
        "readIsDevMode",
      ],
      exports: {
        openTask(params) {
          window.router.navigate({
            to: "/",
            search: {
              taskId: params.taskId,
              prompt: params.taskId === "new" ? params.prompt : undefined,
              attachments:
                params.taskId === "new"
                  ? params.attachments?.map((item) => {
                      return {
                        url: btoa(item.url),
                        name: item.name,
                        contentType: item.contentType,
                      };
                    })
                  : undefined,
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

        onAuthChanged() {
          queryClient.resetQueries();
        },
      },
    },
  );

  return thread.imports;
}

export const vscodeHost = createVSCodeHost();
