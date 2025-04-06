import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiClient } from "@/lib/auth-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import moment from "moment";
import { useEffect, useMemo, useState } from "react"; // Import useMemo
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

export const Route = createFileRoute("/_auth/settings/usage")({
  component: Usage,
});

const chartConfig = {
  promptTokens: {
    label: "Prompt Tokens",
    color: "hsl(var(--chart-1))",
  },
  completionTokens: {
    label: "Completion Tokens",
    color: "hsl(var(--chart-2))",
  },
  // We are stacking prompt and completion, so totalTokens might be redundant in the chart itself
  // but useful for the summary card.
} satisfies ChartConfig;

// Helper function to calculate date range based on the string identifier
const calculateDateRange = (range: string) => {
  const end = moment();
  let start = moment();
  let daysToSubtract = 0;
  switch (range) {
    case "90d":
      start = moment().subtract(90, "days");
      daysToSubtract = 90;
      break;
    case "30d":
      start = moment().subtract(30, "days");
      daysToSubtract = 30;
      break;
    // case "7d":
    default:
      start = moment().subtract(7, "days");
      daysToSubtract = 7;
      break;
  }
  return {
    startDate: start.format("YYYY-MM-DD"),
    endDate: end.format("YYYY-MM-DD"),
    days: daysToSubtract,
  };
};

// Define the fetch function separately for reusability
const fetchUsageData = async (timeRange: string) => {
  const { startDate, endDate } = calculateDateRange(timeRange);
  const params: Record<string, string> = {
    start: startDate,
    end: endDate,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  const response = await apiClient.api.usages.chat.$get({ query: params });

  if (!response.ok) {
    throw new Error(`Failed to fetch usage data for ${timeRange}`);
  }

  return response.json();
};

function Usage() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState("30d");

  useEffect(() => {
    setTimeRange(isMobile ? "7d" : "30d");
  }, [isMobile]);

  useEffect(() => {
    const timeRanges = ["7d", "30d", "90d"];
    for (const range of timeRanges) {
      queryClient.prefetchQuery({
        queryKey: ["usages", "chat", range],
        queryFn: () => fetchUsageData(range),
      });
    }
  }, [queryClient]);

  const usageQuery = useQuery({
    queryKey: ["usages", "chat", timeRange],
    queryFn: () => fetchUsageData(timeRange),
  });

  // Memoize the padded chart data calculation
  const paddedChartData = useMemo(() => {
    if (!usageQuery.data?.daily) {
      // Return empty array or handle loading state appropriately if needed before data arrives
      return [];
    }

    const { startDate, days } = calculateDateRange(timeRange);
    const dailyDataMap = new Map(
      usageQuery.data.daily.map((item) => [item.date, item]),
    );

    const allDatesData = [];
    const currentMoment = moment(startDate);

    // Generate data points for the entire selected range
    // Iterate days + 1 times to include both start and end date if end date is today
    for (let i = 0; i <= days; i++) {
      const dateStr = currentMoment.format("YYYY-MM-DD");
      const existingData = dailyDataMap.get(dateStr);

      allDatesData.push(
        existingData || {
          date: dateStr,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      );
      currentMoment.add(1, "day");
    }

    return allDatesData;
  }, [usageQuery.data?.daily, timeRange]);

  const renderSummaryCards = () => {
    // Initial loading state (before first fetch completes)
    if (usageQuery.isLoading && !usageQuery.data) {
      return (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-3/5" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-4/5" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    // Error state
    if (usageQuery.isError) {
      return (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-center text-destructive">
          Error loading summary data: {(usageQuery.error as Error).message}
        </div>
      );
    }

    // Data loaded successfully
    if (usageQuery.data?.summary) {
      const summary = usageQuery.data.summary;
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Total Tokens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.totalTokens?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Prompt Tokens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.promptTokens?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Completion Tokens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.completionTokens?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // No summary data, but not loading or error (e.g., empty response)
    return (
      <div className="rounded-md border border-border bg-muted/40 p-4 text-center text-muted-foreground">
        No summary data available for the selected period.
      </div>
    );
  };

  return (
    <div className="container max-w-5xl space-y-6">
      {/* Render Summary Cards Section */}
      {renderSummaryCards()}

      {/* Main Chart Card */}
      <Card className="@container/card">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Token Usage</CardTitle>
          <div className="flex items-center gap-2">
            {/* Show loading spinner only when fetching for the *current* view */}
            {usageQuery.isFetching && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
            {/* Desktop Toggle */}
            <ToggleGroup
              type="single"
              value={timeRange}
              onValueChange={(value) => {
                if (value) setTimeRange(value);
              }}
              variant="outline"
              className="hidden @[767px]/card:flex [&>button]:px-4"
              size="sm"
            >
              <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
              <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
              <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
            </ToggleGroup>
            {/* Mobile Select */}
            <Select
              value={timeRange}
              onValueChange={(value) => {
                if (value) setTimeRange(value);
              }}
            >
              <SelectTrigger
                className="flex w-auto @[767px]/card:hidden"
                size="sm"
                aria-label="Select time range"
              >
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="90d" className="rounded-lg">
                  Last 3 months
                </SelectItem>
                <SelectItem value="30d" className="rounded-lg">
                  Last 30 days
                </SelectItem>
                <SelectItem value="7d" className="rounded-lg">
                  Last 7 days
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          {/* Chart Area or Loading/Error/No Data message for chart */}
          {usageQuery.isLoading && !usageQuery.data ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : usageQuery.isError ? (
            <div className="flex h-64 items-center justify-center text-center text-red-500">
              Error loading chart data: {(usageQuery.error as Error).message}
            </div>
          ) : paddedChartData.length > 0 ? ( // Use paddedChartData here
            <div className="h-80">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <AreaChart
                  accessibilityLayer
                  data={paddedChartData} // Use the padded data
                  margin={{
                    left: 12,
                    right: 12,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      // Add check for invalid date string before formatting
                      if (Number.isNaN(date.getTime())) return "";
                      return date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    }}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(value) => {
                          const date = new Date(value);
                          if (Number.isNaN(date.getTime())) return "";
                          return date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          });
                        }}
                      />
                    }
                  />
                  <defs>
                    <linearGradient
                      id="fillPromptTokens"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--color-promptTokens)"
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-promptTokens)"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                    <linearGradient
                      id="fillCompletionTokens"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--color-completionTokens)"
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-completionTokens)"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  {/* Stacked Areas */}
                  <Area
                    dataKey="completionTokens"
                    type="natural"
                    fill="url(#fillCompletionTokens)"
                    stroke="var(--color-completionTokens)"
                    stackId="a"
                  />
                  <Area
                    dataKey="promptTokens"
                    type="natural"
                    fill="url(#fillPromptTokens)"
                    stroke="var(--color-promptTokens)"
                    stackId="a"
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              No daily data available for the selected date range
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
