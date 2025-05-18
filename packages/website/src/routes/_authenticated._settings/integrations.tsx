import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient, authClient } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-hooks";
import { IconBrandGithub, IconBrandSlack } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import { Loader2, Plus } from "lucide-react"; // Removed Unplug
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
    <Card className="w-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
              <IconBrandSlack size={24} className="text-[#4A154B]" />
            </div>
            <div>
              <div className="flex items-center">
                <h3 className="font-semibold text-lg">Slack</h3>
              </div>
              <p className="mt-1 text-muted-foreground text-sm">
                Connect your Slack workspaces to manage team communication.
              </p>
            </div>
          </div>
          <div className="ml-4 flex-shrink-0">
            {isLoading && !integrations ? (
              <Skeleton className="h-8 w-8 rounded-lg" />
            ) : (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border bg-slate-100 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                onClick={handleConnectSlack}
                aria-label="Connect new Slack workspace"
              >
                <Plus
                  size={16}
                  className="text-slate-600 dark:text-slate-400"
                />
              </Button>
            )}
          </div>
        </div>

        {/* Connected Slack Workspaces List / Empty State / Loading State for list */}
        <div className="mt-4">
          {isLoading && !integrations ? ( // Show skeletons if initial integrations fetch is loading
            <div className="space-y-3 border-border border-t pt-4">
              <h4 className="px-1 font-medium text-muted-foreground text-sm">
                <Skeleton className="h-5 w-32" />
              </h4>
              <Skeleton className="h-[58px] w-full rounded-lg" />
              <Skeleton className="h-[58px] w-full rounded-lg" />
            </div>
          ) : !isLoading && slackIntegrations.length > 0 ? (
            <div className="space-y-3 border-border border-t pt-4">
              <h4 className="px-1 font-medium text-muted-foreground text-sm">
                Connected Workspaces
              </h4>
              {slackIntegrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-3 dark:bg-muted/30"
                >
                  <span className="truncate font-medium text-sm">
                    {integration.payload.team?.name || "Slack Workspace"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 flex-shrink-0 px-2 text-destructive text-xs hover:bg-destructive/10"
                    onClick={() => handleDisconnectSlack(integration.id)}
                    disabled={
                      disconnectSlackMutation.isPending &&
                      disconnectSlackMutation.variables === integration.id
                    }
                    title="Disconnect Workspace"
                  >
                    {disconnectSlackMutation.isPending &&
                      disconnectSlackMutation.variables === integration.id && (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" /> // Added mr-1 for spacing when loader is visible
                      )}
                    <span className="inline">Disconnect</span>
                  </Button>
                </div>
              ))}
            </div>
          ) : !isLoading && slackIntegrations.length === 0 ? (
            <div className="rounded-lg border border-border border-dashed p-6 text-center">
              <p className="text-muted-foreground text-sm">
                No Slack workspaces connected yet. Click the '+' above to add
                one.
              </p>
            </div>
          ) : null}
        </div>
      </div>
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
  const githubIntegration = integrations?.find((i) => i.provider === "github");

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
    authClient.signIn.social({
      provider: "github",
      scopes: [
        "gist",
        "read:org",
        "read:user",
        "repo",
        "user:email",
        "workflow",
      ],
      callbackURL: "/integrations?github_connected=true",
    });
  };

  const handleDisconnectGithub = (integrationId: number) => {
    disconnectGithubMutation.mutate(integrationId);
  };

  return (
    <Card className="w-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
              <IconBrandGithub size={24} className="text-foreground" />
            </div>
            <div>
              <div className="flex items-center">
                <h3 className="font-semibold text-lg">GitHub</h3>
              </div>
              <p className="mt-1 text-muted-foreground text-sm">
                Connect your GitHub account to allow Pochi to interact with your
                repositories.
              </p>
            </div>
          </div>

          <div className="ml-4 flex-shrink-0">
            {isLoading && !integrations ? (
              <Skeleton className="h-8 w-8 rounded-lg" />
            ) : githubIntegration ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDisconnectGithub(githubIntegration.id)}
                disabled={disconnectGithubMutation.isPending}
                className="h-8 text-xs"
              >
                {disconnectGithubMutation.isPending && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                Disconnect
              </Button>
            ) : (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border bg-slate-100 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                onClick={handleConnectGithub}
                aria-label="Connect GitHub"
              >
                <Plus
                  size={16}
                  className="text-slate-600 dark:text-slate-400"
                />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// --- Main Integrations Page Component ---

function IntegrationsPage() {
  const { data: session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ["integrations", userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await apiClient.api.integrations.$get();
      if (!response.ok) throw new Error("Failed to fetch integrations");
      const data: ApiIntegrationsResponse = await response.json();
      return data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const slackSuccess = urlParams.get("slack_connected");
    const githubSuccess = urlParams.get("github_connected");

    let needsInvalidation = false;

    if (slackSuccess !== null) {
      needsInvalidation = true;
      if (slackSuccess === "true") {
        toast.success("Slack workspace connected successfully");
      } else {
        toast.error("Failed to connect Slack workspace");
      }
    }

    if (githubSuccess !== null) {
      needsInvalidation = true;
      if (githubSuccess === "true") {
        toast.success("GitHub integration connected successfully");
      } else {
        toast.error("Failed to connect GitHub integration");
      }
    }

    if (needsInvalidation) {
      window.history.replaceState(null, "", window.location.pathname);
      queryClient.invalidateQueries({ queryKey: ["integrations", userId] });
    }
  }, [queryClient, userId]);

  return (
    <div className="w-full space-y-6 md:w-[700px]">
      {/* GitHub Integration Section */}
      <GithubIntegrationSection
        isLoading={isLoading}
        integrations={integrations}
        userId={userId}
        queryClient={queryClient}
      />

      {/* Slack Integration Section */}
      <SlackIntegrationSection
        isLoading={isLoading}
        integrations={integrations}
        userId={userId}
        queryClient={queryClient}
      />
    </div>
  );
}
