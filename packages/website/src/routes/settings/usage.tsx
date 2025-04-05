import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import moment from "moment";
import { useState } from "react";
import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/settings/usage")({
  component: Usage,
});

function Usage() {
  const [startDate, setStartDate] = useState(
    moment().subtract(30, "days").format("YYYY-MM-DD"),
  );
  const [endDate, setEndDate] = useState(moment().format("YYYY-MM-DD"));

  // Query for usage data
  const usageQuery = useQuery({
    queryKey: ["usages", "chat", startDate + "-" + endDate],
    queryFn: async () => {
      // Build the URL parameters for the date range
      const params: Record<string, string> = {
        start: startDate,
        end: endDate,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      // Using the apiClient to make the API call
      const response = await apiClient.api.usages.chat.$get({
        query: params,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch usage data");
      }

      return response.json();
    },
  });

  const handleRangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Trigger a new query by refreshing the query
    usageQuery.refetch();
  };

  return (
    <div className="container max-w-5xl">
      <Card>
        <CardContent>
          <form
            onSubmit={handleRangeSubmit}
            className="mb-6 grid gap-4 md:grid-cols-3"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                required
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                className="w-full"
                disabled={usageQuery.isFetching}
              >
                {usageQuery.isFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Generate Report
              </Button>
            </div>
          </form>

          {usageQuery.isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : usageQuery.isError ? (
            <div className="text-center text-red-500">
              Error loading data: {(usageQuery.error as Error).message}
            </div>
          ) : usageQuery.data?.summary ? (
            <>
              <div className="mb-6 grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Tokens
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {usageQuery.data.summary.totalTokens?.toLocaleString() ||
                        0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Prompt Tokens
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {usageQuery.data.summary.promptTokens?.toLocaleString() ||
                        0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Completion Tokens
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {usageQuery.data.summary.completionTokens?.toLocaleString() ||
                        0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {usageQuery.data.daily && usageQuery.data.daily.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={usageQuery.data.daily}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="promptTokens"
                        name="Prompt Tokens"
                        stroke="#8884d8"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="completionTokens"
                        name="Completion Tokens"
                        stroke="#82ca9d"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="totalTokens"
                        name="Total Tokens"
                        stroke="#ff7300"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center text-muted-foreground">
                  No data available for the selected date range
                </div>
              )}
            </>
          ) : (
            <div className="text-center">
              Please select a date range and generate a report
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
