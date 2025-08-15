import { Thread } from "@quilted/threads";
import {
  type VSCodeHostApi,
  type WebviewHostApi,
  createVscodeHostStub,
} from "@ragdoll/common/vscode-webui-bridge";
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

new Thread<WebviewHostApi, VSCodeHostApi>(
  {
    send(message) {
      window.dispatchEvent(new MessageEvent("message", { data: message }));
    },
    listen(listener) {
      channel.on("message", listener);
    },
  },
  {
    exports: createVscodeHostStub({
      async readCurrentWorkspace() {
        return "/";
      },
    }),
  },
);
