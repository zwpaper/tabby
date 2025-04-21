import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-hooks";
import { IconBrandSlack } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
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

  const slackIntegration = integrations?.find((i) => i.provider === "slack");

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
      toast.success("Slack disconnected successfully");
      // Refetch integrations after disconnection
      queryClient.invalidateQueries({ queryKey: ["integrations", userId] });
    },
    onError: (error) => {
      toast.error("Failed to disconnect Slack", {
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
  const handleDisconnectSlack = () => {
    if (slackIntegration?.id) {
      disconnectSlackMutation.mutate(slackIntegration.id);
    }
  };

  // Handle toggle change
  const handleToggleSlack = (checked: boolean) => {
    if (checked) {
      handleConnectSlack();
    } else {
      handleDisconnectSlack();
    }
  };

  // Check for OAuth redirect completion
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("slack_connected");

    if (success === "true") {
      toast.success("Slack connected successfully");
      // Clean up URL
      window.history.replaceState(null, "", window.location.pathname);
      // Refetch integrations
      queryClient.invalidateQueries({ queryKey: ["integrations", userId] });
    } else if (success === "false") {
      toast.error("Failed to connect Slack");
      // Clean up URL
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [queryClient, userId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {/* Slack Integration Card */}
        <Card className="w-full max-w-xs overflow-hidden border border-border bg-card/50 hover:shadow-sm transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between px-4 py-3 pb-2">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base font-medium flex items-center gap-1">
                <IconBrandSlack size={18} className="text-[#4A154B]" />
                Slack
              </CardTitle>
              <CardDescription className="text-xs">
                Connect your workspace to receive messages, and enable tools
                like sending message to slack.
              </CardDescription>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-20 rounded-full" />
            ) : (
              <div className="flex items-center">
                {!disconnectSlackMutation.isPending ? (
                  <Switch
                    checked={!!slackIntegration}
                    onCheckedChange={handleToggleSlack}
                    disabled={disconnectSlackMutation.isPending}
                    aria-label="Toggle Slack integration"
                  />
                ) : (
                  <Loader2 className="ml-2 h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="px-4 py-2 text-xs text-muted-foreground">
            {isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : slackIntegration ? (
              <div className="flex items-center justify-between">
                <span>
                  Connected to{" "}
                  <a
                    className="font-medium text-foreground"
                    href={`https://slack.com/app_redirect?app=${slackIntegration.payload.appId}&team=${slackIntegration.payload.team?.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {slackIntegration.payload.team?.name || "Slack"}
                  </a>
                </span>
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600">
                  Active
                </span>
              </div>
            ) : (
              "Connect your Slack workspace to receive notifications and interact with your projects."
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
