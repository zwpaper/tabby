import { useQuery } from "@tanstack/react-query";
import { vscodeHost } from "../vscode";

export function useCurrentWorkspace() {
  return useQuery({
    queryKey: ["currentWorkspace"],
    queryFn: () => vscodeHost.readCurrentWorkspace(),
  });
}
