import { QuotaDisplay } from "@/components/settings/quota-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { UserButton } from "@/components/user-button";
import { apiClient, authClient } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-hooks";
import { cn } from "@/lib/utils";
import { IconBrandGithub, IconLogout } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import moment from "moment";
import { useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_base/profile")({
  component: RouteComponent,
});

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

type ApiIntegrationsResponse = InferResponseType<
  (typeof apiClient.api.integrations)["$get"]
>;

// Define the fetch function for task count
const fetchTaskCount = async () => {
  const endDate = moment().format("YYYY-MM-DD");
  const startDate = moment().subtract(30, "days").format("YYYY-MM-DD");

  const response = await apiClient.api.usages.chat.$get({
    query: {
      start: startDate,
      end: endDate,
      tz: timeZone,
      includeDailyUsage: "false",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch task count data");
  }

  return response.json();
};

// Reusable StatItem component
interface StatItemProps {
  label: string;
  value: number;
  isLoading: boolean;
  isError: boolean;
  className?: string;
}

function StatItem({
  label,
  value,
  isLoading,
  isError,
  className,
}: StatItemProps) {
  return (
    <div className={cn("space-y-2 text-center", className)}>
      <div className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
        {label}
      </div>
      {isLoading ? (
        <Skeleton className="mx-auto h-8 w-16" />
      ) : isError ? (
        <div className="font-bold text-2xl text-destructive lg:text-3xl">—</div>
      ) : (
        <div className="font-bold text-2xl text-foreground lg:text-3xl">
          {value.toLocaleString()}
        </div>
      )}
    </div>
  );
}

// Account Card Component
interface AccountCardProps {
  session: ReturnType<typeof useSession>["data"];
}

function AccountCard({ session }: AccountCardProps) {
  const handleSignOut = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
        },
      },
    });
  };

  return (
    <Card className="m-4 rounded-sm border-border/50 py-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="h-16 w-16 flex-shrink-0">
            <UserButton size="icon" classNames={{ base: "h-16 w-16" }} />
          </div>

          {/* Name */}
          <div className="min-w-0 flex-1">
            <div className="mb-1 font-medium text-muted-foreground text-xs">
              Name
            </div>
            <div className="truncate font-medium text-foreground">
              {session?.user?.name || "No name set"}
            </div>
          </div>

          {/* Email */}
          <div className="min-w-0 flex-1">
            <div className="mb-1 font-medium text-muted-foreground text-xs">
              Email
            </div>
            <div className="truncate font-medium text-foreground">
              {session?.user?.email}
            </div>
          </div>

          {/* Sign Out Button */}
          <div className="flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="gap-2"
            >
              <IconLogout size={16} />
              Sign Out
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// GitHub Integration Component
interface GithubConnectCardProps {
  isLoading: boolean;
  integrations: ApiIntegrationsResponse | undefined;
  userId: string | undefined;
  queryClient: ReturnType<typeof useQueryClient>;
}

function GithubConnectCard({
  isLoading,
  integrations,
  userId,
  queryClient,
}: GithubConnectCardProps) {
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
      callbackURL: "/profile?github_connected=true",
    });
  };

  const handleDisconnectGithub = (integrationId: number) => {
    disconnectGithubMutation.mutate(integrationId);
  };

  return (
    <Card className="m-4 rounded-sm border-border/50 p-2 shadow-sm">
      <CardContent className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconBrandGithub size={20} className="text-foreground" />
            <span className="font-medium text-base">GitHub</span>
          </div>

          <div className="flex-shrink-0">
            {isLoading && !integrations ? (
              <Skeleton className="h-6 w-12 rounded-lg" />
            ) : (
              <Switch
                checked={!!githubIntegration}
                onCheckedChange={(checked) => {
                  if (checked) {
                    handleConnectGithub();
                  } else if (githubIntegration) {
                    handleDisconnectGithub(githubIntegration.id);
                  }
                }}
                disabled={disconnectGithubMutation.isPending}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RouteComponent() {
  const { data: session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  const taskCountQuery = useQuery({
    queryKey: ["taskCount", "30d"],
    queryFn: fetchTaskCount,
  });

  const { data: integrations, isLoading: integrationsLoading } = useQuery({
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
    const githubSuccess = urlParams.get("github_connected");

    if (githubSuccess !== null) {
      if (githubSuccess === "true") {
        toast.success("GitHub integration connected successfully");
      } else {
        toast.error("Failed to connect GitHub integration");
      }
      window.history.replaceState(null, "", window.location.pathname);
      queryClient.invalidateQueries({ queryKey: ["integrations", userId] });
    }
  }, [queryClient, userId]);

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-8 lg:px-8">
      {/* Account Information Section */}
      <div className="space-y-4">
        <div className="mx-4 space-y-1">
          <h2 className="font-semibold text-base text-foreground">Account</h2>
          <p className="text-muted-foreground text-xs">
            Your account information and settings
          </p>
        </div>
        <AccountCard session={session} />
      </div>

      {/* Personal Stats Section */}
      <div className="space-y-4">
        <div className="mx-4 space-y-1">
          <h2 className="font-semibold text-base text-foreground">
            Personal Stats
          </h2>
          <p className="text-muted-foreground text-xs">
            Track your usage patterns and monitor your quota consumption
          </p>
        </div>
        <Card className="m-4 rounded-sm border-border/50 py-0 shadow-sm">
          <CardContent className="p-4">
            <div className="space-y-6">
              <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-5">
                {/* Quota Display Section */}
                <div className="lg:col-span-3">
                  <div className="space-y-3">
                    <QuotaDisplay
                      classNames={{
                        title: "text-xs uppercase font-semibold",
                        bar: "h-2",
                      }}
                    />
                  </div>
                </div>

                {/* Stats Section */}
                <StatItem
                  label="TASKS"
                  value={taskCountQuery.data?.summary?.taskCount || 0}
                  isLoading={taskCountQuery.isLoading && !taskCountQuery.data}
                  isError={taskCountQuery.isError}
                />
                <StatItem
                  label="MESSAGES"
                  value={taskCountQuery.data?.summary?.completionCount || 0}
                  isLoading={taskCountQuery.isLoading && !taskCountQuery.data}
                  isError={taskCountQuery.isError}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* External Integrations Section */}
      <div className="space-y-4">
        <div className="mx-4 space-y-1">
          <h2 className="font-semibold text-base text-foreground">
            External Integrations
          </h2>
          <p className="text-muted-foreground text-xs">
            Connect external services to enhance your workflow and productivity
          </p>
        </div>
        <GithubConnectCard
          isLoading={integrationsLoading}
          integrations={integrations}
          userId={userId}
          queryClient={queryClient}
        />
      </div>
    </div>
  );
}
