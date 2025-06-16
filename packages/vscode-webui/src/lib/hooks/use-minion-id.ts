import { useQuery } from "@tanstack/react-query";
import { vscodeHost } from "../vscode";

export function useMinionId() {
  return useQuery({
    queryKey: ["minionId"],
    queryFn: () => vscodeHost.readMinionId(),
  });
}
