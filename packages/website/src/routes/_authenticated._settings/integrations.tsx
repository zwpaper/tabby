import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-hooks";
import { IconBrandGithub, IconBrandSlack } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_settings/integrations")({
  component: IntegrationsPage,
});

type ApiIntegrationsResponse = InferResponseType<
  (typeof apiClient.api.integrations)["$get"]
>;

// --- Slack Integration Component ---

interface SlackIntegrationSectionProps {
  isLoading: boolean;
  integrations: ApiIntegrationsResponse | undefined;
  userId: string | undefined;
  queryClient: ReturnType<typeof useQueryClient>;
}

function SlackIntegrationSection({
  isLoading,
  integrations,
  userId,
  queryClient,
}: SlackIntegrationSectionProps) {
  const slackIntegrations =
    integrations?.filter((i) => i.provider === "slack") || [];

  const disconnectSlackMutation = useMutation({
    mutationFn: async (integrationId: number) => {
      const response = await apiClient.api.integrations[":id"].$delete({
        param: {
          id: integrationId.toString(),
        },
      });
      if (!response.ok) throw new Error("Failed to disconnect Slack");
      return response.json();
    },
    onSuccess: () => {
      toast.success("Slack workspace disconnected successfully");
      queryClient.invalidateQueries({ queryKey: ["integrations", userId] });
    },
    onError: (error) => {
      toast.error("Failed to disconnect Slack workspace", {
        description: error.message,
      });
    },
  });

  const handleConnectSlack = () => {
    window.location.href = "/slack/installations";
  };

  const handleDisconnectSlack = (integrationId: number) => {
    disconnectSlackMutation.mutate(integrationId);
  };

  return (
    <Card className="w-full border border-border bg-card/50 overflow-hidden">
      <CardHeader className="px-6">
        <div className="flex items-center gap-2">
          <IconBrandSlack size={20} className="text-[#4A154B]" />
          <CardTitle className="text-base font-medium">
            Slack Integration
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnectSlack}
            className="flex items-center gap-1 ml-auto"
          >
            <Plus size={16} />
          </Button>
        </div>
        <CardDescription>
          Connect your Slack workspaces to receive messages and enable tools
          like sending messages to Slack.
        </CardDescription>
      </CardHeader>

      {isLoading ? (
        <CardContent>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      ) : slackIntegrations.length === 0 ? (
        <CardContent className="flex flex-col items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">
            No Slack workspaces connected yet.
          </p>
        </CardContent>
      ) : (
        <div className="px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Connected On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slackIntegrations.map((integration) => (
                <TableRow key={integration.id}>
                  <TableCell className="font-medium">
                    <a
                      href={`https://slack.com/app_redirect?app=${integration.payload.appId}&team=${integration.payload.team?.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {integration.payload.team?.name || "Slack Workspace"}
                    </a>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(integration.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDisconnectSlack(integration.id)}
                      disabled={disconnectSlackMutation.isPending}
                      title="Disconnect Workspace"
                    >
                      {disconnectSlackMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      <span className="sr-only">Disconnect Workspace</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

// --- GitHub Integration Component ---

interface GithubIntegrationSectionProps {
  isLoading: boolean;
  integrations: ApiIntegrationsResponse | undefined;
  userId: string | undefined;
  queryClient: ReturnType<typeof useQueryClient>;
}

function GithubIntegrationSection({
  isLoading,
  integrations,
  userId,
  queryClient,
}: GithubIntegrationSectionProps) {
  const githubIntegrations =
    integrations?.filter((i) => i.provider === "github") || [];

  const disconnectGithubMutation = useMutation({
    mutationFn: async (integrationId: number) => {
      const response = await apiClient.api.integrations[":id"].$delete({
        param: {
          id: integrationId.toString(),
        },
      });
      if (!response.ok) throw new Error("Failed to disconnect GitHub");
      return response.json();
    },
    onSuccess: () => {
      toast.success("GitHub integration disconnected successfully");
      queryClient.invalidateQueries({ queryKey: ["integrations", userId] });
    },
    onError: (error) => {
      toast.error("Failed to disconnect GitHub integration", {
        description: error.message,
      });
    },
  });

  const handleConnectGithub = () => {
    window.location.href = "https://github.com/apps/getpochi";
  };

  const handleDisconnectGithub = (integrationId: number) => {
    disconnectGithubMutation.mutate(integrationId);
  };

  return (
    <Card className="w-full border border-border bg-card/50 overflow-hidden">
      <CardHeader className="px-6">
        <div className="flex items-center gap-2">
          <IconBrandGithub size={20} className="text-[#333]" />
          <CardTitle className="text-base font-medium">
            GitHub Integration
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnectGithub}
            className="flex items-center gap-1 ml-auto"
          >
            <Plus size={16} />
          </Button>
        </div>
        <CardDescription>
          Connect your GitHub repositories to enable tools like automated pull
          requests and issue tracking.
        </CardDescription>
      </CardHeader>

      {isLoading ? (
        <CardContent>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      ) : githubIntegrations.length === 0 ? (
        <CardContent className="flex flex-col items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">
            No GitHub repositories connected yet.
          </p>
        </CardContent>
      ) : (
        <div className="px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orgnization / User</TableHead>
                <TableHead>Connected On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {githubIntegrations.map((integration) => (
                <TableRow key={integration.id}>
                  <TableCell className="font-medium">
                    <a
                      href={`https://github.com/${integration.payload.account?.html_url}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {integration.payload.account?.html_url}
                    </a>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(integration.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDisconnectGithub(integration.id)}
                      disabled={disconnectGithubMutation.isPending}
                      title="Disconnect Repository"
                    >
                      {disconnectGithubMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      <span className="sr-only">Disconnect Repository</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

// --- Main Integrations Page Component ---

function IntegrationsPage() {
  const { data: session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  // Fetch user's integrations
  const { data: integrations, isLoading } = useQuery({
    queryKey: ["integrations", userId],
    queryFn: async () => {
      const response = await apiClient.api.integrations.$get();
      if (!response.ok) throw new Error("Failed to fetch integrations");
      // Explicitly type the response
      const data: ApiIntegrationsResponse = await response.json();
      return data;
    },
    enabled: !!userId,
  });

  // Check for OAuth redirect completion
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const slackSuccess = urlParams.get("slack_connected");
    const githubSuccess = urlParams.get("github_connected");
    const needsInvalidation = slackSuccess !== null || githubSuccess !== null;

    if (slackSuccess === "true") {
      toast.success("Slack workspace connected successfully");
    } else if (slackSuccess === "false") {
      toast.error("Failed to connect Slack workspace");
    }

    if (githubSuccess === "true") {
      toast.success("GitHub integration connected successfully");
    } else if (githubSuccess === "false") {
      toast.error("Failed to connect GitHub integration");
    }

    if (needsInvalidation) {
      // Clean up URL
      window.history.replaceState(null, "", window.location.pathname);
      // Refetch integrations
      queryClient.invalidateQueries({ queryKey: ["integrations", userId] });
    }
  }, [queryClient, userId]);

  return (
    <div className="space-y-4 w-full md:w-[700px]">
      {/* Slack Integration Section */}
      <div className="flex flex-col gap-3">
        <SlackIntegrationSection
          isLoading={isLoading}
          integrations={integrations}
          userId={userId}
          queryClient={queryClient}
        />
      </div>

      {/* GitHub Integration Section */}
      <div className="flex flex-col gap-3">
        <GithubIntegrationSection
          isLoading={isLoading}
          integrations={integrations}
          userId={userId}
          queryClient={queryClient}
        />
      </div>
    </div>
  );
}
