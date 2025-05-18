import { useQuery } from "@tanstack/react-query";
import { vscodeHost } from "../vscode";

export function useIsWorkspaceActive() {
  const result = useQuery({
    queryKey: ["isWorkspaceActive"],
    queryFn: () => vscodeHost.isWorkspaceActive(),
  });

  return result;
}
