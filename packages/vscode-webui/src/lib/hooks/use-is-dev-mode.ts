import { signal } from "@preact/signals-core";
import { type ThreadSignal, threadSignal } from "@quilted/threads/signals";
import { useQuery } from "@tanstack/react-query";
import { vscodeHost } from "../vscode";

export const useIsDevMode = (): ThreadSignal<boolean> | undefined => {
  const { data: isDevMode } = useQuery({
    queryKey: ["isDevMode"],
    queryFn: fetchIsDevModeSignal,
  });

  return isDevMode;
};

async function fetchIsDevModeSignal() {
  if (import.meta.env.STORYBOOK) {
    return signal(import.meta.env.STORYBOOK_POCHI_DEV_MODE === "true");
  }
  return threadSignal(await vscodeHost.readIsDevMode());
}
