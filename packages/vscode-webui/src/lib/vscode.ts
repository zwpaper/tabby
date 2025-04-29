import { Thread } from "@quilted/threads";
import type {
  VSCodeHostApi,
  WebviewHostApi,
} from "@ragdoll/vscode-webui-bridge";
import type { WebviewApi } from "vscode-webview";

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
        "readEnvironment",
        "executeToolCall",
        "listFilesInWorkspace",
        "previewToolCall",
        "openFile",
      ],
      exports: {
        openTask(taskId) {
          window.router.navigate({
            to: "/chat",
            search: { taskId },
            replace: true,
          });
        },
      },
    },
  );

  return thread.imports;
}

export const vscodeHost = createVSCodeHost();
