import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { apiClient, authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { IconCreditCard } from "@tabler/icons-react";
import {
  useMutation,
  useQuery,
  type useQueryClient,
} from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
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

type Subscriptions = InferResponseType<
  typeof apiClient.api.billing.subscriptions.$get
>;

export function BillingCard({
  queryClient,
  organizationId,
  subscriptions,
  isLoading,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  organizationId: string;
  subscriptions: Subscriptions | null | undefined;
  isLoading: boolean;
}) {
  const [subscriptionLimitDialogOpen, setSubscriptionLimitDialogOpen] =
    useState(false);

  const billingQuotaQuery = useQuery({
    queryKey: ["billingQuota", organizationId],
    queryFn: async () => {
      const res = await apiClient.api.billing.quota.organization[":orgId"].$get(
        {
          param: {
            orgId: organizationId as string,
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

  const activeSubscription = useMemo(() => {
    return subscriptions?.find((x) => x.status === "active");
  }, [subscriptions]);

  const hasUnpaidSubscription = useMemo(() => {
    return !!subscriptions?.find(
      (x) => x.status === "past_due" || x.status === "unpaid",
    );
  }, [subscriptions]);

  const subscriptionMutation = useMutation({
    mutationFn: async (isSubscribing: boolean) => {
      // upgrade
      if (isSubscribing) {
        if (activeSubscription?.cancelAtPeriodEnd) {
          return authClient.subscription.restore({
            referenceId: organizationId,
          });
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

      return authClient.subscription.cancel({
        referenceId: organizationId,
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

  const totalCredit = billingQuotaQuery.data?.credit?.spent || 0;
  const isCreditLimitReached = billingQuotaQuery.data?.credit?.isLimitReached;
  const totalSpendingInDollars = creditToDollars(totalCredit);
  const creditLimitInDollars = billingQuotaQuery.data?.credit?.limit || 0;

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
  const invoice = invoiceQuery.data;

  return (
    <>
      <Card className="my-4 rounded-sm border-border/50 py-0 shadow-sm">
        <CardContent className={cn("p-4 pb-2")}>
          <div className="flex flex-col justify-between gap-2 md:ml-2 md:flex-row md:items-center">
            <div className="flex shrink-0 items-center gap-3">
              <IconCreditCard size={20} className="text-foreground" />
              <span className="font-medium text-base">Stripe</span>
              <Switch
                checked={!!subscriptions?.length}
                onCheckedChange={subscriptionMutation.mutate}
                disabled={isLoading || subscriptionMutation.isPending}
              />
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

function creditToDollars(credit: number): number {
  return credit / 10_000_000;
}
