import { Thread } from "@quilted/threads";
import type { VSCodeHostApi } from "@ragdoll/vscode-webui-bridge";
import type { WebviewApi } from "vscode-webview";
import { getVSCodeWebviewApi } from "./vscode";

function createVSCodeHost(vscode: WebviewApi<unknown>) {
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

let instance: VSCodeHost | undefined = undefined;

export function getVSCodeHost() {
  if (instance) {
    return instance;
  }
  instance = createVSCodeHost(getVSCodeWebviewApi());
  return instance;
}

export type VSCodeHost = ReturnType<typeof createVSCodeHost>;
