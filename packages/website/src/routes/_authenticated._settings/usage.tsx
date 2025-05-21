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
import { apiClient } from "@/lib/auth-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import moment from "moment";
import { useEffect, useMemo, useState } from "react"; // Import useMemo
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/_settings/usage")({
  component: Usage,
});

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Base chart config (can be extended dynamically)
const baseChartConfig = {
  // Example static entry if needed, otherwise can be empty
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
    tz: timeZone,
  };

  const response = await apiClient.api.usages.chat.$get({ query: params });

  if (!response.ok) {
    throw new Error(`Failed to fetch usage data for ${timeRange}`);
  }

  // Assuming the API returns { summary: {...}, daily: [{ date, modelId, completionCount }] }
  return response.json();
};

// Helper function to format token counts
function formatTokens(tokens: number | null | undefined): string {
  if (tokens == null || tokens === 0) {
    return "0";
  }
  const k = 1000;
  const m = k * 1000;
  const g = m * 1000;
  // Add T, P, E if needed

  if (tokens >= g) {
    return `${(tokens / g).toFixed(1)}G`;
  }
  if (tokens >= m) {
    return `${(tokens / m).toFixed(1)}M`;
  }
  if (tokens >= k) {
    // Use toFixed(0) for k to avoid decimals like 1.2k, show 1k instead
    // Or use toFixed(1) if decimals are desired for k range as well
    return `${(tokens / k).toFixed(0)}k`;
  }
  return tokens.toString(); // Return the number as is if less than 1k
}

// Helper to generate valid CSS variable names and gradient IDs from model IDs
const sanitizeId = (id: string) => id.replace(/[^a-zA-Z0-9]/g, "");

function Usage() {
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState("7d");

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

  // Memoize the processed chart data calculation
  const processedChartData = useMemo(() => {
    if (!usageQuery.data?.daily) {
      return { data: [], models: [], dynamicConfig: {} };
    }

    const dailyData = usageQuery.data.daily;
    const { startDate, days } = calculateDateRange(timeRange);

    // 1. Find all unique models and group data by date
    const models = new Set<string>();
    const dataByDate = new Map<string, Record<string, number>>();

    for (const item of dailyData) {
      // Ensure modelId is treated as a string, handle potential null/undefined
      const modelIdStr = String(item.modelId || "unknown");
      models.add(modelIdStr);
      const dateEntry = dataByDate.get(item.date) || {};
      // Sum counts for the same model on the same date (though API should aggregate this)
      dateEntry[modelIdStr] =
        (dateEntry[modelIdStr] || 0) + (item.completionCount || 0);
      dataByDate.set(item.date, dateEntry);
    }

    const uniqueModels = Array.from(models).sort(); // Sort for consistent color assignment

    // 2. Generate dynamic chart config for models
    const dynamicConfig: ChartConfig = {};
    uniqueModels.forEach((modelId, index) => {
      const sanitized = sanitizeId(modelId);
      // Simple hue rotation for colors (adjust saturation/lightness as needed)
      dynamicConfig[sanitized] = {
        label: modelId, // Use modelId directly as label
        color: `hsl(var(--chart-${(index % 5) + 1}))`,
      };
    });

    // 3. Pad data for the entire date range
    const paddedData = [];
    const currentMoment = moment(startDate);

    for (let i = 0; i <= days; i++) {
      const dateStr = currentMoment.format("YYYY-MM-DD");
      const existingData = dataByDate.get(dateStr) || {};

      const dayData: Record<string, string | number> = { date: dateStr };
      for (const modelId of uniqueModels) {
        dayData[modelId] = existingData[modelId] || 0; // Default to 0
      }

      paddedData.push(dayData);
      currentMoment.add(1, "day");
    }

    return { data: paddedData, models: uniqueModels, dynamicConfig };
  }, [usageQuery.data?.daily, timeRange]);

  // Combine base and dynamic config
  const finalChartConfig = useMemo<ChartConfig>(
    () => ({
      ...baseChartConfig,
      ...processedChartData.dynamicConfig,
    }),
    [processedChartData.dynamicConfig],
  );

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
              <CardTitle className="font-medium text-sm">
                Total Tokens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">
                {formatTokens(summary.totalTokens)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-medium text-sm">
                Prompt Tokens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">
                {formatTokens(summary.promptTokens)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-medium text-sm">
                Completion Tokens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">
                {formatTokens(summary.completionTokens)}
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
    <div className="container space-y-6">
      {/* Render Summary Cards Section */}
      {renderSummaryCards()}

      {/* Main Chart Card */}
      <Card className="@container/card">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle># Requests by Model</CardTitle> {/* Updated Title */}
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
              className="@[767px]/card:flex hidden [&>button]:px-4"
              size="sm"
            >
              <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
              <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
              <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            </ToggleGroup>
            {/* Mobile Select */}
            <Select
              value={timeRange}
              onValueChange={(value) => {
                if (value) setTimeRange(value);
              }}
            >
              <SelectTrigger
                className="flex @[767px]/card:hidden w-auto"
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
            <div className="flex h-80 items-center justify-center">
              {" "}
              {/* Adjusted height */}
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : usageQuery.isError ? (
            <div className="flex h-80 items-center justify-center text-center text-red-500">
              {" "}
              {/* Adjusted height */}
              Error loading chart data: {(usageQuery.error as Error).message}
            </div>
          ) : processedChartData.data.length > 0 &&
            processedChartData.models.length > 0 ? ( // Check for models too
            <div className="h-80">
              {" "}
              {/* Ensure consistent height */}
              <ChartContainer
                config={finalChartConfig}
                className="h-full w-full"
              >
                {/* Use finalChartConfig */}
                <AreaChart
                  accessibilityLayer
                  data={processedChartData.data} // Use the processed data
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
                      const date = moment(value).toDate();
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
                          const date = moment(value).toDate();
                          if (Number.isNaN(date.getTime())) return "";
                          return date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          });
                        }}
                        // Custom formatter to show model breakdown
                        formatter={(value, name) => {
                          // 'name' will be the modelId (dataKey)
                          // 'value' will be the count for that model on that date
                          // Check if the key exists in our config (filters out 'date')
                          const sanitized = sanitizeId(name as string);
                          if (finalChartConfig[sanitized]) {
                            return (
                              <div className="flex items-center gap-2">
                                <div className="flex flex-1 justify-between gap-1 leading-none">
                                  <span className="text-muted-foreground">
                                    {finalChartConfig[sanitized].label}
                                  </span>
                                  <span>{value}</span> {/* The count */}
                                </div>
                              </div>
                            );
                          }
                          return null; // Don't render if name not in config
                        }}
                      />
                    }
                  />
                  <defs>
                    {/* Dynamically generate gradients for each model */}
                    {processedChartData.models.map((modelId) => {
                      const sanitized = sanitizeId(modelId); // Sanitize ID
                      return (
                        <linearGradient
                          key={modelId}
                          id={`fill${sanitized}`} // Use sanitized ID
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={`var(--color-${sanitized})`} // Use original modelId for CSS var
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor={`var(--color-${sanitized})`} // Use original modelId for CSS var
                            stopOpacity={0.1}
                          />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  {/* Dynamically generate Area components for each model */}
                  {processedChartData.models.map((modelId) => {
                    const sanitized = sanitizeId(modelId); // Sanitize ID
                    return (
                      <Area
                        key={modelId}
                        dataKey={modelId} // Use original modelId as dataKey
                        type="natural"
                        fill={`url(#fill${sanitized})`} // Reference sanitized gradient ID
                        stroke={`var(--color-${sanitized})`} // Use original modelId for CSS var
                        stackId="a" // Stack all areas together
                        name={modelId} // Ensure name prop is set for tooltip mapping
                      />
                    );
                  })}
                </AreaChart>
              </ChartContainer>
            </div>
          ) : (
            <div className="flex h-80 items-center justify-center text-muted-foreground">
              {" "}
              {/* Adjusted height */}
              No daily data available for the selected date range
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
