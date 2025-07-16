import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { apiClient, authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { creditToDollars } from "@/lib/utils/credit";
import { IconCreditCard } from "@tabler/icons-react";
import {
  useMutation,
  useQuery,
  type useQueryClient,
} from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import moment from "moment";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { SpendingLimitForm } from "../profile/spending-limit-form";
import { InvoiceView } from "../subscription/invoice-view";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { SubscriptionLimitDialog } from "./subscription-limit-dialog";

export function BillingCard({
  queryClient,
  organizationId,
  isOwner,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  organizationId: string;
  isOwner: boolean;
}) {
  const [subscriptionLimitDialogOpen, setSubscriptionLimitDialogOpen] =
    useState(false);
  const subscriptionQuery = useQuery({
    queryKey: ["subscription", organizationId],
    queryFn: async () => {
      const { data, error } = await authClient.subscription.list({
        query: {
          referenceId: organizationId,
        },
      });
      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
  });

  const billingQuotaQuery = useQuery({
    queryKey: ["billingQuota", organizationId],
    queryFn: async () => {
      const res = await apiClient.api.billing.quota.organization[":orgId"].$get(
        {
          param: {
            orgId: organizationId,
          },
        },
      );
      if (!res.ok) {
        throw new Error("Failed to fetch quota");
      }
      return await res.json();
    },
  });

  const monthlyUsageLimitMutation = useMutation({
    mutationFn: async (limit: number) => {
      const res = await apiClient.api.billing.quota.organization[
        ":orgId"
      ].usage.$put({
        param: {
          orgId: organizationId,
        },
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

  const subscription = useMemo(() => {
    return subscriptionQuery.data?.find(
      (x) => x.referenceId === organizationId,
    );
  }, [subscriptionQuery.data, organizationId]);

  const subscriptionMutation = useMutation({
    mutationFn: async (isSubscribing: boolean) => {
      if (isSubscribing) {
        if (subscription?.cancelAtPeriodEnd) {
          return authClient.subscription.restore();
        }

        // subscription limit
        // const { data: subscriptions } = await authClient.subscription.list();
        // const existingOtherSubscription = subscriptions?.find(
        //   (x) => x.plan !== "organization",
        // );
        // if (existingOtherSubscription) {
        //   setSubscriptionLimitDialogOpen(true);
        //   return;
        // }
        return authClient.subscription.upgrade({
          annual: false,
          plan: "organization",
          referenceId: organizationId,
          successUrl: window.location.href,
          cancelUrl: window.location.href,
        });
      }

      // cancel
      return authClient.subscription.cancel({
        returnUrl: window.location.href,
      });
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

  const isEffectivelyActive =
    !!subscription && !subscription?.cancelAtPeriodEnd;

  const totalCredit = billingQuotaQuery.data?.credit?.spent || 0;
  const isCreditLimitReached = billingQuotaQuery.data?.credit?.isLimitReached;
  const totalSpendingInDollars = creditToDollars(totalCredit);
  const creditLimitInDollars = billingQuotaQuery.data?.credit?.limit || 0;

  const invoiceQuery = useQuery({
    queryKey: ["invoice", subscription?.stripeSubscriptionId],
    queryFn: async () => {
      if (!subscription) {
        throw new Error("Subscription not found");
      }
      const response = await apiClient.api.billing.invoices.$get({
        query: {
          subscriptionId: subscription.id,
        },
      });
      if (!response.ok) {
        throw new Error("Fail to fetch");
      }
      return response.json();
    },
    enabled: !!subscription?.stripeSubscriptionId,
  });
  const invoice = invoiceQuery.data;

  return (
    <>
      <Card className="m-4 rounded-sm border-border/50 py-0 shadow-sm">
        <CardContent
          className={cn("p-4", {
            "pb-0": !!subscription,
          })}
        >
          <div className="flex items-center justify-between gap-2 md:ml-2">
            <div className="flex shrink-0 items-center gap-3">
              <IconCreditCard size={20} className="text-foreground" />
              <span className="font-medium text-base">Stripe</span>
              {subscriptionQuery.isLoading ? (
                <Skeleton className="h-6 w-12 rounded-lg" />
              ) : (
                <Switch
                  checked={isEffectivelyActive}
                  onCheckedChange={subscriptionMutation.mutate}
                  disabled={
                    !isOwner ||
                    subscriptionMutation.isPending ||
                    subscriptionQuery.isLoading
                  }
                />
              )}
            </div>
            {subscription && (
              <div className="ml-2 flex flex-1 flex-col justify-center text-muted-foreground text-xs">
                {subscription.periodEnd && (
                  <span>
                    {subscription.cancelAtPeriodEnd
                      ? "Expires on "
                      : "Renews on "}
                    {moment(subscription.periodEnd).format("MMMM D, YYYY")}
                  </span>
                )}
                {subscription.cancelAtPeriodEnd && (
                  <span>
                    Your plan will be canceled at the end of the current billing
                    period.
                  </span>
                )}
              </div>
            )}
            {!!subscription && isOwner && (
              <a href="/api/billing/portal?return_pathname=team">
                <Button variant="outline" size="sm">
                  Manage
                </Button>
              </a>
            )}
          </div>
          {billingQuotaQuery.data?.plan && isCreditLimitReached && (
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
              label="CURRENT SPENDING"
              value={totalSpendingInDollars.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
              isLoading={billingQuotaQuery.isLoading && !billingQuotaQuery.data}
              isError={billingQuotaQuery.isError}
            />
            <StatItem
              label="SPENDING LIMIT"
              value={creditLimitInDollars.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
              isLoading={billingQuotaQuery.isLoading && !billingQuotaQuery.data}
              isError={billingQuotaQuery.isError}
            />
          </div>
          {invoice && <InvoiceView invoice={invoice} />}
          {
            <Accordion type="single" collapsible>
              <AccordionItem value="spending-limit">
                <AccordionTrigger className="flex-none px-1 font-medium md:px-2">
                  Spending Settings
                </AccordionTrigger>
                <AccordionContent className="px-1 md:px-2">
                  {billingQuotaQuery.isLoading && !billingQuotaQuery.data ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <SpendingLimitForm
                      disabled={!isOwner}
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
                      maxBudgetUsd={50_000}
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
        planName="Team"
        existingPlanName="Pro"
        url="/api/billing/portal?return_pathname=team"
      />
    </>
  );
}

// todo extract
interface StatItemProps {
  label: string;
  value: number | string;
  isLoading: boolean;
  isError: boolean;
  className?: string;
  description?: string;
}

function StatItem({
  label,
  value,
  isLoading,
  isError,
  className,
  description,
}: StatItemProps) {
  const displayValue =
    typeof value === "number" ? value.toLocaleString() : value;
  return (
    <div className={cn("space-y-2 text-center", className)}>
      <div className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
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
