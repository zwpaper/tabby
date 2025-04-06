// import { IconChartBar } from "@tabler/icons-react"; // Icon removed for cleaner look
import { Skeleton } from "@/components/ui/skeleton";
// ./packages/website/src/components/settings/quota-display.tsx
import { apiClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
// Removed Card imports

export function QuotaDisplay() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["billingQuota"],
    queryFn: async () => {
      const res = await apiClient.api.billing.quota.$get();
      if (!res.ok) {
        throw new Error("Failed to fetch quota");
      }
      return await res.json();
    },
  });

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (error) {
    // Don't render anything if there's an error, or show a minimal error state
    // console.error("Error loading quota:", error.message);
    return null; // Or return a small error indicator if preferred
  }

  if (!data) {
    return null;
  }

  const { usages, limits } = data;
  // Handle potential division by zero if limits are 0
  const basicUsagePercent =
    limits.basic > 0 ? Math.min((usages.basic / limits.basic) * 100, 100) : 0;
  const premiumUsagePercent =
    limits.premium > 0
      ? Math.min((usages.premium / limits.premium) * 100, 100)
      : 0;

  return (
    <div className="mb-4 px-2 pb-1">
      <div className="text-xs text-muted-foreground mb-3 font-bold">
        {data.plan}
      </div>
      <div className="space-y-2">
        {data.plan === "Community" && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-muted-foreground">Basic</span>
              <span className="font-mono">
                {usages.basic} / {limits.basic}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1 dark:bg-gray-700">
              <div
                className="bg-blue-500 h-1 rounded-full"
                style={{ width: `${basicUsagePercent}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-muted-foreground">Premium</span>
            <span className="font-mono">
              {usages.premium} / {limits.premium}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1 dark:bg-gray-700">
            <div
              className="bg-amber-500 h-1 rounded-full"
              style={{ width: `${premiumUsagePercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
