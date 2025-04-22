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
import { IconBrandSlack } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_settings/integrations")({
  component: IntegrationsPage,
});

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
      return response.json();
    },
    enabled: !!userId,
  });

  // Filter to get all Slack integrations
  const slackIntegrations =
    integrations?.filter((i) => i.provider === "slack") || [];

  // Handle Slack disconnection
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
      // Refetch integrations after disconnection
      queryClient.invalidateQueries({ queryKey: ["integrations", userId] });
    },
    onError: (error) => {
      toast.error("Failed to disconnect Slack workspace", {
        description: error.message,
      });
    },
  });

  // Handle connect button click
  const handleConnectSlack = () => {
    // Redirect to Slack OAuth flow
    window.location.href = "/slack/installations";
  };

  // Handle disconnect button click
  const handleDisconnectSlack = (integrationId: number) => {
    disconnectSlackMutation.mutate(integrationId);
  };

  // Check for OAuth redirect completion
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("slack_connected");

    if (success === "true") {
      toast.success("Slack workspace connected successfully");
      // Clean up URL
      window.history.replaceState(null, "", window.location.pathname);
      // Refetch integrations
      queryClient.invalidateQueries({ queryKey: ["integrations", userId] });
    } else if (success === "false") {
      toast.error("Failed to connect Slack workspace");
      // Clean up URL
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [queryClient, userId]);

  return (
    <div className="space-y-4">
      {/* Slack Integration Section */}
      <div className="flex flex-col gap-3">
        <Card className="w-full md:w-[420px] border border-border bg-card/50 overflow-hidden">
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
      </div>
    </div>
  );
}
