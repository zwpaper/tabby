import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { SocialLinks } from "@ragdoll/common";
import { useQuery } from "@tanstack/react-query";

export const Quota: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["billingQuota"],
    queryFn: async () => {
      const res = await apiClient.api.billing.quota.me.$get();
      if (!res.ok) {
        throw new Error("Failed to fetch quota");
      }
      return await res.json();
    },
  });

  if (isLoading) {
    return <Skeleton className="h-17 w-full bg-secondary" />;
  }

  if (error) {
    return null;
  }

  if (!data) {
    return null;
  }

  const { usages, limits } = data;
  const basicUsagePercent =
    limits.basic > 0 ? Math.min((usages.basic / limits.basic) * 100, 100) : 0;
  const premiumUsagePercent =
    limits.premium > 0
      ? Math.min((usages.premium / limits.premium) * 100, 100)
      : 0;

  // Show warning when premium usage exceeds 80% (less than 20% credit remaining)
  const showCreditWarning = premiumUsagePercent > 80;

  return (
    <div className="select-none px-2">
      <div className="space-y-2">
        {data.plan === "Community" && (
          <div className="flex flex-col gap-1">
            <div className="mb-0.5 flex justify-between text-sm">
              <span className="text-muted-foreground">Basic</span>
              <span className="font-mono">
                {usages.basic} / {limits.basic}
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-1 rounded-full bg-primary"
                style={{ width: `${basicUsagePercent}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <div className="mb-0.5 flex justify-between text-sm">
            <span className="text-muted-foreground">Premium</span>
            <span className="font-mono">
              {usages.premium} / {limits.premium}
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-1 rounded-full bg-primary"
              style={{ width: `${premiumUsagePercent}%` }}
            />
          </div>
        </div>
      </div>
      {/* Credit Warning Banner */}
      {showCreditWarning && (
        <div className="mt-3 mb-3 rounded-lg border bg-muted p-2 ">
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs ">
              Want more credits? Join our Discord channel and share feedback or
              report bugs to earn credit rewards.
            </p>
            <a
              href={SocialLinks.Discord}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="sm"
                className={cn(
                  buttonVariants({ variant: "secondary" }),
                  "w-full",
                )}
              >
                <span className="hidden min-[280px]:inline ">
                  Join Discord for Credit Rewards
                </span>
                <span className="min-[280px]:hidden">Join Discord</span>
              </Button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
