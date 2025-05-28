import { threadSignal } from "@quilted/threads/signals";
import { useQuery } from "@tanstack/react-query";
import { vscodeHost } from "../vscode";

/**
 * Hook to get active editor tabs
 * Uses ThreadSignal for real-time updates
 */
/** @useSignals */
export const useActiveTabs = () => {
  const { data: activeTabsSignal } = useQuery({
    queryKey: ["activeTabs"],
    queryFn: fetchActiveTabs,
  });

  if (activeTabsSignal === undefined) {
    return [];
  }

  const tabs = activeTabsSignal.value;

  return tabs;
};

/**
 * Fetch active tabs from workspace API
 */
async function fetchActiveTabs() {
  return threadSignal(await vscodeHost.readActiveTabs());
}
