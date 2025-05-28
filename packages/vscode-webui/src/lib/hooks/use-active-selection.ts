import { threadSignal } from "@quilted/threads/signals";
import { useQuery } from "@tanstack/react-query";
import { vscodeHost } from "../vscode";

/**
 * Hook to get active editor selection
 * Uses ThreadSignal for real-time updates
 */
/** @useSignals */
export const useActiveSelection = () => {
  const { data: activeSelectionSignal } = useQuery({
    queryKey: ["activeSelection"],
    queryFn: fetchActiveSelection,
  });

  if (activeSelectionSignal === undefined) {
    return undefined;
  }

  return activeSelectionSignal.value;
};

/**
 * Fetch active tabs from workspace API
 */
async function fetchActiveSelection() {
  return threadSignal(await vscodeHost.readActiveSelection());
}
