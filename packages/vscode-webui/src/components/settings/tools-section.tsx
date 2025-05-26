import { apiClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { Blocks, Dot, RefreshCw } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button, buttonVariants } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Section } from "./section";
import { ToolBadgeList } from "./tool-badge";

interface Tool {
  id: string;
  description: string;
}

export const ToolsSection: React.FC = () => {
  const { data: toolsData, isLoading } = useQuery({
    queryKey: ["tools"],
    queryFn: async () => {
      const res = await apiClient.api.tools.$get();
      if (!res.ok) {
        throw new Error("Failed to fetch available tools");
      }
      return res.json() as Promise<Tool[]>;
    },
  });

  const renderToolsContent = () => {
    if (!toolsData || isLoading) {
      return (
        <div className="flex flex-wrap gap-2">
          {new Array(12).fill(null).map((_, i) => {
            const randomWidth = (Math.floor(Math.random() * 20) + 10) * 0.3;
            return (
              <Skeleton
                key={i}
                style={{
                  width: `${randomWidth}rem`,
                }}
                className="h-6 bg-secondary"
              />
            );
          })}
        </div>
      );
    }

    return <ToolBadgeList tools={toolsData} />;
  };

  const queryClient = useQueryClient();
  const onRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: ["integrations"],
    });
  };

  const { data: connectedIntegrationsData, isFetching } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const res = await apiClient.api.integrations.$get();
      if (!res.ok) {
        throw new Error("Failed to fetch integration status");
      }
      return res.json();
    },
  });

  const rightElement = (
    <div className="mb-1 flex gap-1">
      <a
        href={`${getServerBaseUrl()}/integrations`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <Blocks className="size-4" />
        Manage
      </a>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={isFetching}
        className="flex items-center gap-1"
      >
        <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
        Refresh
      </Button>
    </div>
  );

  return (
    <Section title="Tools" rightElement={rightElement}>
      {connectedIntegrationsData && (
        <Connections integrations={connectedIntegrationsData} />
      )}
      <div className="h-2" />
      {false && renderToolsContent()}
    </Section>
  );
};

interface IntegrationDisplayConfig {
  provider: string;
  displayName: string;
  capabilities: string[];
}

const integrationDisplayConfigs: IntegrationDisplayConfig[] = [
  {
    provider: "github",
    displayName: "GitHub",
    capabilities: ["issue", "pr", "repository"],
  },
  {
    provider: "slack",
    displayName: "Slack",
    capabilities: ["message", "history"],
  },
];

const Connections: React.FC<{
  integrations: InferResponseType<typeof apiClient.api.integrations.$get>;
}> = ({ integrations }) => {
  return (
    <div className="w-full">
      <div className="space-y-2">
        {integrationDisplayConfigs.map((config) => {
          const isConnected = !!integrations?.find(
            (i) => i.provider === config.provider,
          );
          return (
            <div
              key={config.provider}
              className="flex justify-between rounded-md border px-2 py-2"
            >
              <span className="flex items-center font-semibold">
                <Dot
                  className={cn("size-6", {
                    "text-green-400": isConnected,
                    "text-muted-foreground": !isConnected,
                  })}
                />
                {config.displayName}
              </span>
              {config.capabilities.length > 0 && (
                <span className="space-x-2">
                  {config.capabilities.map((capability) => (
                    <Badge key={capability} className="bg-accent">
                      {capability}
                    </Badge>
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
