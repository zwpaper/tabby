import { threadSignal } from "@quilted/threads/signals";
import { useQuery } from "@tanstack/react-query";
import { vscodeHost } from "../vscode";

export const useIsDevMode = () => {
  const { data: isDevMode } = useQuery({
    queryKey: ["isDevMode"],
    queryFn: fetchIsDevModeSignal,
  });

  if (isDevMode === undefined) {
    return false;
  }

  return isDevMode.value;
};

async function fetchIsDevModeSignal() {
  return threadSignal(await vscodeHost.readIsDevMode());
}
