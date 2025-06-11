import { threadSignal } from "@quilted/threads/signals";
import { useQuery } from "@tanstack/react-query";
import { vscodeHost } from "../vscode";

/** @useSignals */
export const useTaskRunners = () => {
  const { data } = useQuery({
    queryKey: ["taskRunners"],
    queryFn: async () => threadSignal(await vscodeHost.readTaskRunners()),
  });

  return data?.value || {};
};
