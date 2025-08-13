import { threadSignal } from "@quilted/threads/signals";
import { useQuery } from "@tanstack/react-query";
import { vscodeHost } from "../vscode";

/** @useSignals */
export const usePochiModelSettings = () => {
  const { data: pochiModelSettingsSignal } = useQuery({
    queryKey: ["pochiModelSettings"],
    queryFn: fetchPochiModelSettings,
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (pochiModelSettingsSignal === undefined) {
    return undefined;
  }

  const settings = pochiModelSettingsSignal.value;

  return settings;
};

/**
 * Fetch pochi models settings from workspace API
 */
async function fetchPochiModelSettings() {
  const signal = threadSignal(await vscodeHost.readPochiModelSettings());
  return signal;
}
