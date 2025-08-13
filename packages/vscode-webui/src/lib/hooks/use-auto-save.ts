import { threadSignal } from "@quilted/threads/signals";
import { useQuery } from "@tanstack/react-query";
import { vscodeHost } from "../vscode";

/** @useSignals this comment is needed to enable signals in this hook */
export const useAutoSaveDisabled = () => {
  const { data: autoSaveDisabledSignal } = useQuery({
    queryKey: ["autoSaveDisabled"],
    queryFn: fetchAutoSaveDisabled,
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (autoSaveDisabledSignal === undefined) {
    return true;
  }

  return autoSaveDisabledSignal.value ?? true;
};

async function fetchAutoSaveDisabled() {
  const signal = threadSignal(await vscodeHost.readAutoSaveDisabled());
  return signal;
}
