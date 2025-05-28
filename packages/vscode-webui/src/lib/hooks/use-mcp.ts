import { threadSignal } from "@quilted/threads/signals";
import type { McpStatus } from "@ragdoll/vscode-webui-bridge";
import { useQuery } from "@tanstack/react-query";
import { vscodeHost } from "../vscode";

export const useMcp = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["mcpStatus"],
    queryFn: fetchMcpStatus,
  });

  const parsed: McpStatus = data
    ? JSON.parse(data.value)
    : { connections: {}, toolset: {} };

  return {
    connections: parsed.connections,
    toolset: parsed.toolset,
    isLoading: isLoading,
  };
};

async function fetchMcpStatus() {
  return threadSignal(await vscodeHost.readMcpStatus());
}
