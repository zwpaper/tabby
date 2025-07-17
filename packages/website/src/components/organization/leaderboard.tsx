import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { apiClient, authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import { useState } from "react";

interface OrganizationUsageData {
  summary: {
    completionCount: number;
    taskCount: number;
    activeUsers: number;
  };
  users: {
    userId: string;
    name: string | null;
    email: string;
    image: string | null;
    completionCount: number;
    taskCount: number;
  }[];
}

// Reusable StatItem component
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

export function UsageLeaderboard() {
  const [timeRange, setTimeRange] = useState("7d");
  const { data: organization, isPending } = authClient.useActiveOrganization();
  const organizationId = organization?.id;

  const {
    data: usageData,
    isPending: isUsagePending,
    isError,
  } = useQuery<OrganizationUsageData | null>({
    queryKey: ["organizationUsage", organizationId, timeRange],
    queryFn: async () => {
      if (!organizationId) return null;
      const now = moment();
      let start: string;
      switch (timeRange) {
        case "1h":
          start = now.clone().subtract(1, "hour").toISOString();
          break;
        case "12h":
          start = now.clone().subtract(12, "hours").toISOString();
          break;
        case "24h":
          start = now.clone().subtract(24, "hours").toISOString();
          break;
        case "7d":
          start = now.clone().subtract(7, "days").toISOString();
          break;
        case "1m":
          start = now.clone().subtract(1, "month").toISOString();
          break;
        default:
          start = now.clone().subtract(7, "days").toISOString();
      }

      const res = await apiClient.api.usages.organization[":orgId"].chat.$get({
        param: { orgId: organizationId },
        query: {
          start,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch usage data");
      }
      return await res.json();
    },
    enabled: !!organizationId,
  });

  const isLoading = isPending || isUsagePending;

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-8 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="font-bold text-3xl tracking-tight">Leaderboard</h1>
        <ToggleGroup
          className="mt-4 md:mt-0 [&>button]:px-2"
          type="single"
          defaultValue="7d"
          onValueChange={(value: string) => {
            if (value) setTimeRange(value);
          }}
        >
          <ToggleGroupItem value="1h">1h</ToggleGroupItem>
          <ToggleGroupItem value="12h">12h</ToggleGroupItem>
          <ToggleGroupItem value="24h">24h</ToggleGroupItem>
          <ToggleGroupItem value="7d">1w</ToggleGroupItem>
          <ToggleGroupItem value="1m">1m</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-12">
        <div>
          <h2 className="font-semibold text-base text-foreground">Team</h2>
          <div className="grid grid-cols-3 gap-8 pt-4">
            <StatItem
              label="Active Users"
              value={usageData?.summary.activeUsers ?? 0}
              isLoading={isLoading}
              isError={isError}
            />
            <StatItem
              label="Tasks"
              value={usageData?.summary.taskCount ?? 0}
              isLoading={isLoading}
              isError={isError}
            />
            <StatItem
              label="Messages"
              value={usageData?.summary.completionCount ?? 0}
              isLoading={isLoading}
              isError={isError}
            />
          </div>
        </div>

        <div>
          <div className="space-y-1">
            <h2 className="font-semibold text-base text-foreground">Members</h2>
            <p className="text-muted-foreground text-xs">
              An overview of usage stats for each member.
            </p>
          </div>
          <div className="mt-4">
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead className="text-right">Tasks</TableHead>
                    <TableHead className="text-right">Messages</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageData?.users.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.image ?? undefined} />
                            <AvatarFallback>
                              {user.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{user.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {user.taskCount}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {user.completionCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
