import { SpendingLimitForm } from "@/components/profile/spending-limit-form";
import { InvoiceView } from "@/components/subscription/invoice-view";
import { SubscriptionLimitDialog } from "@/components/team/subscription-limit-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useGithubAuth } from "@/hooks/use-github-auth";
import { apiClient, authClient } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-hooks";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@daveyplate/better-auth-ui";
import {
  IconBrandGithub,
  IconBrandSlack,
  IconLogout,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import { AlertTriangle, CreditCard as IconCreditCard } from "lucide-react";
import moment from "moment";
import { useEffect, useMemo, useState } from "react";
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
  value: number | string;
  isLoading: boolean;
  isError: boolean;
  className?: string;
  description?: string;
  classNames?: {
    label?: string;
  };
}

function StatItem({
  label,
  value,
  isLoading,
  isError,
  className,
  description,
  classNames,
}: StatItemProps) {
  const displayValue =
    typeof value === "number" ? value.toLocaleString() : value;
  return (
    <div className={cn("space-y-2 text-center", className)}>
      <div
        className={cn(
          "font-medium text-muted-foreground text-xs uppercase tracking-wider",
          classNames?.label,
        )}
      >
        {label}
      </div>
      {isLoading ? (
        <Skeleton className="mx-auto h-9 w-16" />
      ) : isError ? (
        <div className="font-bold text-2xl text-destructive lg:text-3xl">—</div>
      ) : (
        <div>
          <div className="font-bold text-2xl text-foreground lg:text-3xl">
            {displayValue}
          </div>
          {description && (
            <div className="mt-0.5 text-muted-foreground text-xs">
              {description}
            </div>
          )}
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

  const { data: auth } = useSession();
  return (
    <Card className="my-4 rounded-sm border-border/50 py-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
          {/* Avatar */}
          <div className="size-16 flex-shrink-0">
            <UserAvatar user={auth?.user} className="size-16" />
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
          <div className="flex-shrink-0 md:mr-4">
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
  const { connectGithub } = useGithubAuth();

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

  const handleDisconnectGithub = (integrationId: number) => {
    disconnectGithubMutation.mutate(integrationId);
  };

  return (
    <Card className="my-4 rounded-sm border-border/50 p-2 shadow-sm">
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
                    connectGithub();
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

// Slack Workspace Installation Component
interface SlackWorkspaceCardProps {
  isLoading: boolean;
  integrations: ApiIntegrationsResponse | undefined;
  userId: string | undefined;
  queryClient: ReturnType<typeof useQueryClient>;
}

function SlackWorkspaceCard({
  isLoading,
  integrations,
  userId,
  queryClient,
}: SlackWorkspaceCardProps) {
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
    <Card className="my-4 rounded-sm border-border/50 py-0 shadow-sm">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconBrandSlack
                size={20}
                className="text-[#4A154B] dark:text-zinc-200"
              />
              <span className="font-medium text-base">Workspaces</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnectSlack}
              className="text-xs"
            >
              Add
            </Button>
          </div>

          {/* Workspace List */}
          {isLoading && !integrations ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : slackIntegrations.length > 0 ? (
            <div className="space-y-2">
              {slackIntegrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between rounded-lg bg-muted/30 p-3"
                >
                  <div className="font-medium text-sm">
                    {integration.payload.team?.name || "Slack Workspace"}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnectSlack(integration.id)}
                    disabled={disconnectSlackMutation.isPending}
                    className="text-destructive text-xs hover:bg-destructive/10"
                  >
                    Disconnect
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border border-dashed p-6 text-center">
              <p className="text-muted-foreground text-sm">
                No workspaces connected yet. Add a workspace to start using
                Pochi in your Slack channels.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BillingCard({
  queryClient,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { data: session } = useSession();
  const [subscriptionLimitDialogOpen, setSubscriptionLimitDialogOpen] =
    useState(false);

  const { data: subscriptions, isLoading: isSubscriptionsLoading } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const resp = await apiClient.api.billing.subscriptions.$get();
      if (!resp.ok) {
        return null;
      }
      const result = await resp.json();
      return result;
    },
  });

  const activeSubscription = useMemo(() => {
    return subscriptions?.find((x) => x.status === "active");
  }, [subscriptions]);

  const hasUnpaidSubscription = useMemo(() => {
    return !!subscriptions?.find(
      (x) => x.status === "past_due" || x.status === "unpaid",
    );
  }, [subscriptions]);

  const invoiceQuery = useQuery({
    queryKey: ["invoice", activeSubscription?.stripeSubscriptionId],
    queryFn: async () => {
      if (!activeSubscription) {
        throw new Error("Subscription not found");
      }
      const response = await apiClient.api.billing.invoices.$get({
        query: {
          subscriptionId: activeSubscription.id,
        },
      });
      if (!response.ok) {
        throw new Error("Fail to fetch");
      }
      return response.json();
    },
    enabled: !!activeSubscription?.stripeSubscriptionId,
  });
  const upcomingInvoice = invoiceQuery.data;

  const billingQuotaQuery = useQuery({
    queryKey: ["billingQuota"],
    queryFn: async () => {
      const res = await apiClient.api.billing.quota.me.$get();
      if (!res.ok) {
        throw new Error("Failed to fetch quota");
      }
      return await res.json();
    },
  });

  const monthlyUsageLimitMutation = useMutation({
    mutationFn: async (limit: number) => {
      const res = await apiClient.api.billing.quota.me.usage.$put({
        json: { limit },
      });
      if (!res.ok) {
        throw new Error("Failed to update monthly limit");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast.success("Monthly limit updated successfully");
      // queryClient.invalidateQueries({ queryKey: ["monthlyCreditLimit"] });
    },
    onError: () => {
      toast.error("Failed to update monthly limit");
    },
  });

  const handleToggleSubscription = (isSubscribing: boolean) => {
    if (session?.session.activeOrganizationId) {
      toast.info(
        "You are currently in a team. Please leave the team before subscribing to the personal plan.",
        {
          duration: 10_000,
        },
      );
      return;
    }
    subscriptionMutation.mutate(isSubscribing);
  };

  const subscriptionMutation = useMutation({
    mutationFn: async (isSubscribing: boolean) => {
      try {
        // upgrade
        if (isSubscribing) {
          if (activeSubscription?.cancelAtPeriodEnd) {
            return authClient.subscription.restore();
          }

          // const { data: subscriptions } = await authClient.subscription.list();
          // const existingOtherSubscription = subscriptions?.find(
          //   (x) => x.plan !== "pro",
          // );
          // if (existingOtherSubscription) {
          //   setSubscriptionLimitDialogOpen(true);
          //   return;
          // }

          return authClient.subscription.upgrade({
            annual: false,
            plan: "pro",
            successUrl: window.location.href,
            cancelUrl: window.location.href,
          });
        }

        return authClient.subscription.cancel({
          returnUrl: window.location.href,
        });
      } catch {
        toast.error("Failed to fetch");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (error) => {
      toast.error("Failed to update subscription", {
        description: error.message,
      });
    },
  });

  const totalCredit = billingQuotaQuery.data?.credit?.spent || 0;
  const isCreditLimitReached = billingQuotaQuery.data?.credit?.isLimitReached;
  const totalSpendingInDollars = creditToDollars(totalCredit);
  const freeCreditInDollars = 20;
  const freeCreditRemaining = Math.max(
    0,
    freeCreditInDollars - totalSpendingInDollars,
  );
  const spentInDollars = Math.max(
    0,
    totalSpendingInDollars - freeCreditInDollars,
  );

  return (
    <>
      <Card className="my-4 rounded-sm border-border/50 py-0 shadow-sm">
        <CardContent className={cn("p-4 pb-2")}>
          <div className="flex flex-col justify-between gap-2 md:ml-2 md:flex-row md:items-center">
            <div className="flex shrink-0 items-center gap-3">
              <IconCreditCard size={20} className="text-foreground" />
              <span className="font-medium text-base">Stripe</span>
              {isSubscriptionsLoading ? (
                <Skeleton className="h-6 w-12 rounded-lg" />
              ) : (
                <Switch
                  checked={!!subscriptions?.length}
                  onCheckedChange={handleToggleSubscription}
                  disabled={
                    subscriptionMutation.isPending || isSubscriptionsLoading
                  }
                />
              )}
            </div>
            {hasUnpaidSubscription ? (
              <div className="ml-2 inline-flex flex-1 items-center gap-1 text-sm">
                <AlertTriangle className="size-4" />
                <span>
                  You have unpaid invoices. Please{" "}
                  <a
                    href="/api/billing/portal"
                    className="text-primary underline hover:opacity-70"
                  >
                    make a payment
                  </a>{" "}
                  to continue using Pochi.
                </span>
              </div>
            ) : activeSubscription ? (
              <div className="ml-2 flex flex-1 flex-col justify-center text-muted-foreground text-xs">
                {activeSubscription.periodEnd && (
                  <span>
                    {activeSubscription.cancelAtPeriodEnd
                      ? "Expires on "
                      : "Renews on "}
                    {moment(activeSubscription.periodEnd).format(
                      "MMMM D, YYYY",
                    )}
                  </span>
                )}
                {activeSubscription.cancelAtPeriodEnd && (
                  <span>
                    Your plan will be canceled at the end of the current billing
                    period.
                  </span>
                )}
              </div>
            ) : null}
            {!!subscriptions?.length && (
              <a href="/api/billing/portal">
                <Button variant="outline" size="sm">
                  Manage
                </Button>
              </a>
            )}
          </div>
          {isCreditLimitReached && (
            <Alert variant="destructive" className="mt-4 border-0">
              <AlertTriangle />
              <AlertTitle>Credit Limit Reached</AlertTitle>
              <AlertDescription>
                You have reached your monthly credit limit.
              </AlertDescription>
            </Alert>
          )}
          <div className="mt-4 mb-8 border-border/50 border-t" />
          <div className="mb-4 grid grid-cols-2 items-start gap-8">
            <StatItem
              label="FREE CREDIT REMAINING"
              value={freeCreditRemaining.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
              isLoading={billingQuotaQuery.isLoading && !billingQuotaQuery.data}
              isError={billingQuotaQuery.isError}
              classNames={{
                label: "h-8 md:h-auto",
              }}
            />
            <StatItem
              label="CURRENT SPENDING"
              value={spentInDollars.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
              isLoading={billingQuotaQuery.isLoading && !billingQuotaQuery.data}
              isError={billingQuotaQuery.isError}
              classNames={{
                label: "h-8 md:h-auto",
              }}
            />
          </div>
          {upcomingInvoice && <InvoiceView invoice={upcomingInvoice} />}
          {
            <Accordion type="single" collapsible>
              <AccordionItem value="spending-limit">
                <AccordionTrigger className="flex-none px-1 font-medium md:px-2">
                  Spending Settings
                </AccordionTrigger>
                <AccordionContent className="p-1 md:px-2">
                  {billingQuotaQuery.isLoading && !billingQuotaQuery.data ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <SpendingLimitForm
                      defaultValues={{
                        monthlyCreditLimit:
                          billingQuotaQuery.data?.credit?.limit,
                      }}
                      onSubmit={(values) => {
                        monthlyUsageLimitMutation.mutate(
                          values.monthlyCreditLimit,
                        );
                      }}
                      isSubmitting={monthlyUsageLimitMutation.isPending}
                      maxBudgetUsd={2000}
                    />
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          }
        </CardContent>
      </Card>
      <SubscriptionLimitDialog
        open={subscriptionLimitDialogOpen}
        onOpenChange={setSubscriptionLimitDialogOpen}
        planName="Pro"
        // FIXME(jueliang): should be dynamic
        existingPlanName="Team"
        url="/api/billing/portal"
      />
    </>
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
    const slackSuccess = urlParams.get("slack_connected");

    let needsInvalidation = false;

    if (githubSuccess !== null) {
      needsInvalidation = true;
      if (githubSuccess === "true") {
        toast.success("GitHub integration connected successfully");
      } else {
        toast.error("Failed to connect GitHub integration");
      }
    }

    if (slackSuccess !== null) {
      needsInvalidation = true;
      if (slackSuccess === "true") {
        toast.success("Slack workspace connected successfully");
      } else {
        toast.error("Failed to connect Slack workspace");
      }
    }

    if (needsInvalidation) {
      window.history.replaceState(null, "", window.location.pathname);
      queryClient.invalidateQueries({ queryKey: ["integrations", userId] });
    }
  }, [queryClient, userId]);

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-2 pt-6 pb-8 md:px-6 md:pt-8 lg:px-8">
      {/* Account Information Section */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-base text-foreground">Account</h2>
          <p className="text-muted-foreground text-xs">
            Your account information and settings
          </p>
        </div>
        <AccountCard session={session} />
      </div>

      {/* Personal Stats Section */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-base text-foreground">
            Personal Stats
          </h2>
          <p className="text-muted-foreground text-xs">
            Track your usage patterns and monitor your quota consumption
          </p>
        </div>
        <Card className="my-4 rounded-sm border-border/50 py-0 shadow-sm">
          <CardContent className="p-4">
            <div className="space-y-6">
              <div className="grid grid-cols-2 items-start gap-8">
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
        <div className="space-y-1">
          <h2 className="font-semibold text-base text-foreground">
            External Integrations
          </h2>
          <p className="text-muted-foreground text-xs">
            Connect external services to enable Pochi to utilize them in its
            tools using
          </p>
        </div>
        <GithubConnectCard
          isLoading={integrationsLoading}
          integrations={integrations}
          userId={userId}
          queryClient={queryClient}
        />
      </div>

      {/* Slack Workspace Installation Section */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-base text-foreground">Slack</h2>
          <p className="text-muted-foreground text-xs">
            Connect Slack workspaces to use Pochi directly in your team channels
          </p>
        </div>
        <SlackWorkspaceCard
          isLoading={integrationsLoading}
          integrations={integrations}
          userId={userId}
          queryClient={queryClient}
        />
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-base text-foreground">Billing</h2>
          <p className="text-muted-foreground text-xs">
            Manage your billing and subscription details
          </p>
        </div>
        <BillingCard queryClient={queryClient} />
      </div>
    </div>
  );
}

function creditToDollars(credit: number): number {
  return credit / 10_000_000;
}
