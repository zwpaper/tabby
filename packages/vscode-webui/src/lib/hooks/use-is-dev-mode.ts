import { threadSignal } from "@quilted/threads/signals";
import { vscodeHost } from "../vscode";

const isDevMode = threadSignal(await vscodeHost.readIsDevMode());

export const useIsDevMode = () => {
  return isDevMode.value;
};
