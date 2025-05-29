import { threadSignal } from "@quilted/threads/signals";
import type { McpConnection, McpStatus } from "@ragdoll/vscode-webui-bridge";
import { useQueries, useQuery } from "@tanstack/react-query";
import { vscodeHost } from "../vscode";

/** @useSignals */
export const useMcp = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["mcpStatus"],
    queryFn: fetchMcpStatus,
  });

  const parsed: McpStatus = data?.value ?? { connections: {}, toolset: {} };
  const connectNames = Object.keys(parsed.connections);

  const toolsQueries = useQueries({
    queries: connectNames.map((connectionName) => ({
      queryKey: ["mcpConnectTools", connectionName],
      queryFn: async () => {
        const connection = parsed.connections[connectionName];
        return {
          name: connectionName,
          tools: connection?.tools || {},
        };
      },
      enabled: parsed.connections[connectionName]?.status === "ready",
      staleTime: 2 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
    })),
  });

  const mcpTools: Record<string, McpConnection["tools"]> = {};
  for (const query of toolsQueries) {
    if (query.data) {
      mcpTools[query.data.name] = query.data.tools;
    }
  }

  const mergedConnections: Record<string, McpConnection> = {};
  for (const [name, connection] of Object.entries(parsed.connections)) {
    mergedConnections[name] = {
      ...connection,
      tools: mcpTools[name] || connection.tools,
    };
  }

  return {
    connections: mergedConnections,
    toolset: parsed.toolset,
    isLoading: isLoading,
  };
};

async function fetchMcpStatus() {
  return threadSignal(await vscodeHost.readMcpStatus());
}
