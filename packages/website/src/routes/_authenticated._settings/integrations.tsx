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
import { apiClient, authClient } from "@/lib/auth-client";
import {
  useListAccounts,
  useSession,
  useUnlinkAccount,
} from "@/lib/auth-hooks";
import { IconBrandGithub, IconBrandSlack } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
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
    <Card className="w-full overflow-hidden border border-border bg-card/50">
      <CardHeader className="px-6">
        <div className="flex items-center gap-2">
          <IconBrandSlack size={20} className="text-[#4A154B]" />
          <CardTitle className="font-medium text-base">
            Slack Integration
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnectSlack}
            className="ml-auto flex items-center gap-1"
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
          <p className="text-muted-foreground text-sm">
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
                  <TableCell className="text-muted-foreground text-xs">
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

// --- GitHub App Integration Component ---

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
      if (!response.ok) throw new Error("Failed to disconnect GitHub App");
      return response.json();
    },
    onSuccess: () => {
      toast.success("GitHub App integration disconnected successfully");
      queryClient.invalidateQueries({ queryKey: ["integrations", userId] });
    },
    onError: (error) => {
      toast.error("Failed to disconnect GitHub App integration", {
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
    <Card className="w-full overflow-hidden border border-border bg-card/50">
      <CardHeader className="px-6">
        <div className="flex items-center gap-2">
          <IconBrandGithub size={20} className="text-[#333]" />
          <CardTitle className="font-medium text-base">
            GitHub App Integration
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnectGithub}
            className="ml-auto flex items-center gap-1"
          >
            <Plus size={16} />
          </Button>
        </div>
        <CardDescription>
          Connect your GitHub account by installing our GitHub App. This allows
          Pochi to interact with your repositories.
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
          <p className="text-muted-foreground text-sm">
            No GitHub App installations found.
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
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(integration.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDisconnectGithub(integration.id)}
                      disabled={disconnectGithubMutation.isPending}
                      title="Disconnect GitHub App Installation"
                    >
                      {disconnectGithubMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      <span className="sr-only">
                        Disconnect GitHub App Installation
                      </span>
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

// --- GitHub OAuth Integration Component ---
function GithubOauthIntegrationSection() {
  const { data: accounts, isLoading: isLoadingAccounts } = useListAccounts();
  const { data: githubOauthData, isLoading: isLoadingGithubOauthData } =
    useQuery({
      queryKey: ["githubOauthIntegration"],
      queryFn: async () => {
        const response = await apiClient.api.integrations.github.$get();
        if (!response.ok)
          throw new Error("Failed to fetch GitHub OAuth status");
        return response.json();
      },
    });

  const githubOauthIntegration = accounts?.find((a) => a.provider === "github");
  const disconnectGithubOauthMutation = useUnlinkAccount();

  const handleConnectGithubOauth = () => {
    if (!githubOauthData?.scopes) {
      toast.error("GitHub OAuth scopes not loaded yet.");
      return;
    }
    authClient.signIn.social({
      provider: "github",
      scopes: githubOauthData.scopes,
      callbackURL: "/integrations/?github_oauth_connected=true",
    });
  };

  const handleDisconnectGithubOauth = async (accountId: string) => {
    disconnectGithubOauthMutation.mutate({
      providerId: "github",
      accountId,
    });
  };

  const isLoading = isLoadingAccounts || isLoadingGithubOauthData;

  return (
    <Card className="w-full overflow-hidden border border-border bg-card/50">
      <CardHeader className="px-6">
        <div className="flex items-center gap-2">
          <IconBrandGithub size={20} className="text-[#333]" />
          <CardTitle className="font-medium text-base">
            GitHub OAuth Integration
          </CardTitle>
          {!isLoading && githubOauthData?.status === "not-connected" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnectGithubOauth}
              className="ml-auto flex items-center gap-1"
              disabled={
                disconnectGithubOauthMutation.isPending ||
                isLoadingGithubOauthData
              }
            >
              <Plus size={16} /> Connect
            </Button>
          )}
          {!isLoading && githubOauthData?.status === "missing-scopes" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnectGithubOauth} // Re-use connect logic to request missing scopes
              className="ml-auto flex items-center gap-1"
              disabled={
                disconnectGithubOauthMutation.isPending ||
                isLoadingGithubOauthData
              }
              title="Request missing repository access scopes"
            >
              <RefreshCw size={16} /> Grant
            </Button>
          )}
          {!isLoading &&
            githubOauthData?.status === "connected" &&
            githubOauthIntegration && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleDisconnectGithubOauth(githubOauthIntegration.accountId)
                }
                className="ml-auto flex items-center gap-1 text-destructive hover:bg-destructive/10"
                disabled={disconnectGithubOauthMutation.isPending}
                title="Disconnect GitHub OAuth"
              >
                {disconnectGithubOauthMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                Disconnect
              </Button>
            )}
        </div>
        <CardDescription>
          Connect your GitHub account using OAuth to allow Pochi to perform
          actions on your behalf.
        </CardDescription>
      </CardHeader>

      {isLoading ? (
        <CardContent>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      ) : githubOauthData?.status === "not-connected" ||
        !githubOauthIntegration ? (
        <CardContent className="flex flex-col items-center justify-center text-center">
          <p className="text-muted-foreground text-sm">
            GitHub OAuth not connected.
          </p>
        </CardContent>
      ) : (
        <CardContent className="flex flex-col items-center justify-center text-center">
          <div className="flex flex-col items-center justify-center text-center">
            <p className="text-muted-foreground text-sm">
              Connected on{" "}
              {new Date(githubOauthIntegration.createdAt).toLocaleDateString()}
            </p>
            {githubOauthIntegration.scopes &&
              githubOauthIntegration.scopes.length > 0 && (
                <p className="mt-1 text-muted-foreground text-sm">
                  Granted Scopes: {githubOauthIntegration.scopes.join(", ")}
                </p>
              )}
          </div>
        </CardContent>
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
    const githubOauthSuccess = urlParams.get("github_oauth_connected");

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
        toast.success("GitHub App integration connected successfully");
      } else {
        toast.error("Failed to connect GitHub App integration");
      }
    }

    if (githubOauthSuccess !== null) {
      needsInvalidation = true;
      if (githubOauthSuccess === "true") {
        toast.success("GitHub OAuth connected successfully");
      } else {
        toast.error("Failed to connect GitHub OAuth");
      }
    }

    if (needsInvalidation) {
      // Clean up URL
      window.history.replaceState(null, "", window.location.pathname);
      // Refetch integrations
      queryClient.invalidateQueries({ queryKey: ["integrations", userId] });
      queryClient.invalidateQueries({ queryKey: ["listAccounts"] }); // Invalidate accounts to refetch scopes
      queryClient.invalidateQueries({ queryKey: ["githubOauthIntegration"] }); // Invalidate github oauth integration data
    }
  }, [queryClient, userId]);

  return (
    <div className="w-full space-y-4 md:w-[700px]">
      {/* Slack Integration Section */}
      <div className="flex flex-col gap-3">
        <SlackIntegrationSection
          isLoading={isLoading}
          integrations={integrations}
          userId={userId}
          queryClient={queryClient}
        />
      </div>

      {/* GitHub App Integration Section */}
      <div className="flex flex-col gap-3">
        <GithubIntegrationSection
          isLoading={isLoading}
          integrations={integrations}
          userId={userId}
          queryClient={queryClient}
        />
      </div>

      {/* GitHub OAuth Integration Section */}
      <div className="flex flex-col gap-3">
        <GithubOauthIntegrationSection />
      </div>
    </div>
  );
}
