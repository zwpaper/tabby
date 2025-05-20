import { useQuery } from "@tanstack/react-query";
import { vscodeHost } from "../vscode";

export function useCurrentWorkspace() {
  const result = useQuery({
    queryKey: ["currentWorkspace"],
    queryFn: () => vscodeHost.readCurrentWorkspace(),
  });

  return result;
}
