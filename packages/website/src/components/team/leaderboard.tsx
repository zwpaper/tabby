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
  description?: string;
}

function StatItem({
  label,
  value,
  isLoading,
  isError,
  description,
}: StatItemProps) {
  const displayValue =
    typeof value === "number" ? value.toLocaleString() : value;
  return (
    <div className="space-y-2">
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
        <div>
          <h1 className="font-bold text-4xl text-foreground tracking-tight">
            Leaderboard
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Track your team's AI usage and productivity
          </p>
        </div>
        <ToggleGroup
          className="mt-4 rounded-lg border border-border p-1 md:mt-0 [&>button]:px-3 [&>button]:py-1.5"
          type="single"
          defaultValue="7d"
          onValueChange={(value: string) => {
            if (value) setTimeRange(value);
          }}
        >
          <ToggleGroupItem value="1h" className="font-medium text-xs">
            1h
          </ToggleGroupItem>
          <ToggleGroupItem value="12h" className="font-medium text-xs">
            12h
          </ToggleGroupItem>
          <ToggleGroupItem value="24h" className="font-medium text-xs">
            24h
          </ToggleGroupItem>
          <ToggleGroupItem value="7d" className="font-medium text-xs">
            7d
          </ToggleGroupItem>
          <ToggleGroupItem value="1m" className="font-medium text-xs">
            30d
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-12">
        <div>
          <h2 className="font-semibold text-foreground text-lg">
            Team Overview
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="text-center">
              <StatItem
                label="Active Users"
                value={usageData?.summary.activeUsers ?? 0}
                isLoading={isLoading}
                isError={isError}
              />
            </div>
            <div className="text-center">
              <StatItem
                label="Tasks"
                value={usageData?.summary.taskCount ?? 0}
                isLoading={isLoading}
                isError={isError}
              />
            </div>
            <div className="text-center">
              <StatItem
                label="Messages"
                value={usageData?.summary.completionCount ?? 0}
                isLoading={isLoading}
                isError={isError}
              />
            </div>
          </div>
        </div>

        <div>
          <div className="space-y-1">
            <h2 className="font-semibold text-foreground text-lg">
              Member Performance
            </h2>
            <p className="text-muted-foreground text-sm">
              See how each team member is contributing to AI usage and
              productivity.
            </p>
          </div>
          <div className="mt-6">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-3 py-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-12" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border border-b">
                      <TableHead className="w-[280px] font-semibold text-foreground">
                        Member
                      </TableHead>
                      <TableHead className="text-right font-semibold text-foreground">
                        Tasks
                      </TableHead>
                      <TableHead className="text-right font-semibold text-foreground">
                        Messages
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageData?.users.map((user) => (
                      <TableRow
                        key={user.userId}
                        className="border-border/50 border-b transition-colors last:border-b-0 hover:bg-muted/20"
                      >
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage
                                src={user.image ?? undefined}
                                className="object-cover"
                              />
                              <AvatarFallback className="bg-muted text-muted-foreground">
                                {user.name?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-foreground">
                                {user.name}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-right font-mono text-sm">
                          {user.taskCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-3 text-right font-mono text-sm">
                          {user.completionCount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
