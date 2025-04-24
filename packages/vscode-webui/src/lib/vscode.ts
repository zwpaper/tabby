import type { WebviewApi } from "vscode-webview";
let instance: WebviewApi<unknown> | undefined = undefined;

export function getVSCodeWebviewApi() {
  if (instance) {
    return instance;
  }
  instance = acquireVsCodeApi();
  return instance;
}
