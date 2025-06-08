import { useQuery } from "@tanstack/react-query";
import { isVSCodeEnvironment, vscodeHost } from "../vscode";

export function useCurrentWorkspace() {
  const enabled = isVSCodeEnvironment();
  const { data, isFetching } = useQuery({
    queryKey: ["currentWorkspace"],
    queryFn: () => vscodeHost.readCurrentWorkspace(),
    enabled,
  });

  // If we are in a VSCode environment, return the data and isFetching.
  // This allows page can be rendered in storybook without VSCode.
  if (enabled) {
    return { data, isFetching };
  }

  return {
    data: "/",
    isFetching: false,
  };
}
