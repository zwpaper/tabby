import { Thread } from "@quilted/threads";
import type { VSCodeHostApi } from "@ragdoll/vscode-webui-bridge";
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
  const thread = new Thread<VSCodeHostApi, unknown>(
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
      imports: ["getToken", "setToken"],
    },
  );

  return thread.imports;
}

export const vscodeHost = createVSCodeHost();
