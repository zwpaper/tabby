import { createFileRoute } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import {
  Check as IconCheck,
  CreditCard as IconCreditCard,
  ExternalLink as IconExternalLink,
  Loader2 as IconLoader, // Added loader icon
  Receipt as IconReceipt,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient, authClient } from "@/lib/auth-client";
import moment from "moment";

export const Route = createFileRoute("/_auth/settings/billing")({
  loader: async () => {
    const { data, error } = await authClient.subscription.list();
    if (error) {
      throw new Error(error.message);
    }
    return {
      activeSubscriptions: data || null,
    };
  },
  component: Billing,
});

type BillingCycle = "monthly" | "yearly";

function SubscriptionPlan({
  name,
  price,
  yearlyPrice,
  description,
  features,
  isPopular,
  isActive,
  billingCycle,
  onSelect,
  isLoading,
}: {
  name: string;
  price: string;
  yearlyPrice?: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  isActive?: boolean;
  billingCycle: BillingCycle;
  onSelect: () => void;
  isLoading: boolean; // Added loading prop
}) {
  const displayPrice =
    billingCycle === "yearly" && yearlyPrice ? yearlyPrice : price;
  const frequencyText =
    price !== "Free" ? (billingCycle === "yearly" ? "/year" : "/month") : "";

  return (
    <Card className="flex flex-col min-w-xs max-w-sm grow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">{name}</CardTitle>
          {isPopular && <Badge variant="secondary">Most Popular</Badge>}
          {isActive && <Badge>Current Plan</Badge>}
        </div>
        <div className="flex items-baseline">
          <span className="text-3xl font-bold">{displayPrice}</span>
          {frequencyText && (
            <span className="text-muted-foreground ml-1">{frequencyText}</span>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center">
              <IconCheck className="mr-2 h-4 w-4 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant={isActive ? "outline" : "default"}
          onClick={onSelect}
          disabled={isActive || isLoading} // Disable button if it's the active plan
        >
          {isActive
            ? "Current Plan"
            : price === "Free"
              ? "Downgrade"
              : "Select Plan"}
          {isLoading && !isActive && <IconLoader className="animate-spin" />}
        </Button>
      </CardFooter>
    </Card>
  );
}

type Invoice = InferResponseType<
  typeof apiClient.api.billing.history.$get
>["data"][0];

function BillingHistory() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchInvoices = useCallback(async (after?: string) => {
    if (!after) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      queryParams.set("limit", "10"); // Fetch 10 invoices per page
      if (after) {
        queryParams.set("after", after);
      }

      const response = await apiClient.api.billing.history.$get({
        query: Object.fromEntries(queryParams.entries()),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch billing history: ${response.statusText}`,
        );
      }

      const responseData = await response.json();

      setInvoices((prevInvoices) =>
        after ? [...prevInvoices, ...responseData.data] : responseData.data,
      );
      setHasMore(responseData.hasMore);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred.",
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const loadMore = () => {
    if (hasMore && invoices.length > 0) {
      const lastInvoiceId = invoices[invoices.length - 1].id;
      fetchInvoices(lastInvoiceId);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100); // Amount is in cents
  };

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case "paid":
        return "default";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-4">
      <div>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <p className="text-red-600">Error: {error}</p>
        ) : invoices.length === 0 ? (
          <p>No invoices found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    {moment(new Date(invoice.created * 1000)).format(
                      "MMMM D, YYYY",
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getStatusBadgeVariant(invoice.status)}
                      className="capitalize"
                    >
                      {invoice.status || "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(invoice.total, invoice.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {invoice.url ? (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={invoice.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View <IconExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {hasMore && !loading && !error && (
          <div className="w-full flex justify-center mt-1">
            <Button onClick={loadMore} disabled={loadingMore} variant="outline">
              {loadingMore ? "Loading..." : "Load More"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Billing() {
  const { activeSubscriptions } = Route.useLoaderData();
  const selectedPlan = activeSubscriptions?.[0]?.plan || "free";
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null); // Track loading state for specific plan

  const plans = [
    {
      id: "free",
      name: "Community",
      price: "Free",
      description: "Basic features for personal projects",
      features: [
        "10 basic model requests per month",
        "5 premium model requests per month",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      price: "$19",
      yearlyPrice: "$182", // Added yearly price
      description: "Everything in Community, plus more power and features",
      features: [
        "Unlimited basic model requests",
        "500 premium model requests per month",
      ],
      isPopular: true,
    },
  ];

  const handlePlanChange = async (planId: string) => {
    if (planId === selectedPlan || loadingPlan) return; // Do nothing if the selected plan is clicked or already loading

    setLoadingPlan(planId); // Set loading state for this plan
    try {
      if (planId === "pro") {
        await authClient.subscription.upgrade({
          annual: billingCycle === "yearly",
          plan: "pro",
          successUrl: window.location.href, // Return to current page
          cancelUrl: window.location.href, // Return to current page
        });
      }
      if (planId === "free") {
        await authClient.subscription.cancel({
          returnUrl: window.location.href, // Return to current page
        });
      }
    } catch (error) {
      console.error("Failed to change plan:", error);
      // Optionally: show an error message to the user
    } finally {
      setLoadingPlan(null); // Reset loading state regardless of success or failure
    }
  };

  return (
    <div className="container max-w-4xl">
      <Tabs defaultValue="plans">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="plans">
            <IconCreditCard className="mr-2 h-4 w-4" />
            Subscription
          </TabsTrigger>
          <TabsTrigger value="history">
            <IconReceipt className="mr-2 h-4 w-4" />
            Invoices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Plans</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Billing Cycle:
                </span>
                <Select
                  value={billingCycle}
                  onValueChange={(value) =>
                    setBillingCycle(value as BillingCycle)
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select billing cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly (Save 20%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-4 mb-8 justify-around flex-wrap">
              {plans.map((plan) => (
                <SubscriptionPlan
                  key={plan.id}
                  name={plan.name}
                  price={plan.price}
                  yearlyPrice={plan.yearlyPrice} // Pass yearly price
                  description={plan.description}
                  features={plan.features}
                  isPopular={plan.isPopular}
                  isActive={plan.id === selectedPlan}
                  billingCycle={billingCycle} // Pass billing cycle
                  onSelect={() => handlePlanChange(plan.id)}
                  isLoading={!!loadingPlan}
                />
              ))}
            </div>

            <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
              <div>
                <h3 className="font-medium">Need a custom plan?</h3>
                <p className="text-sm text-muted-foreground">
                  Contact us for a tailored solution for your specific needs
                </p>
              </div>
              <Button variant="outline">Contact Sales</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <BillingHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
