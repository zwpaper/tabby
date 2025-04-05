import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import moment from "moment";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/auth-client";

export const Route = createFileRoute("/settings/usage")({
  component: Usage,
});

function Usage() {
  const [startDate, setStartDate] = useState(moment().subtract(30, "days").format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(moment().format("YYYY-MM-DD"));
  const [tabValue, setTabValue] = useState<"today" | "range">("today");

  // Query for usage data
  const usageQuery = useQuery({
    queryKey: ["usages", "chat", tabValue === "today" ? "today" : startDate + "-" + endDate],
    queryFn: async () => {
      // Build the appropriate URL parameters based on selected tab
      const params: Record<string, string> = {};
      
      if (tabValue === "today") {
        // For today's data, use today's date for both start and end
        const today = moment().format("YYYY-MM-DD");
        params.start = today;
        params.end = today;
      } else {
        // For range data, use the selected range
        params.start = startDate;
        params.end = endDate;
      }
      
      // Using the apiClient to make the API call
      const response = await apiClient.api.usages.chat.$get({
        query: params
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch usage data");
      }
      
      return response.json();
    },
  });

  const handleTabChange = (value: string) => {
    setTabValue(value as "today" | "range");
  };

  const handleRangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Trigger a new query by refreshing the query
    usageQuery.refetch();
  };

  // Calculate today's statistics separately, if we're in today mode
  const todayStats = tabValue === "today" && usageQuery.data?.summary;

  return (
    <div className="container mx-auto max-w-5xl">
      <p className="text-muted-foreground">View your token usage statistics below.</p>
      <Tabs defaultValue="today" className="mt-6" onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="today">Today's Usage</TabsTrigger>
          <TabsTrigger value="range">Date Range</TabsTrigger>
        </TabsList>
        
        <TabsContent value="today">
          <div className="grid gap-6 md:grid-cols-3">
            {usageQuery.isLoading ? (
              <div className="col-span-3 flex h-40 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : usageQuery.isError ? (
              <div className="col-span-3 text-center text-red-500">
                Error loading data: {(usageQuery.error as Error).message}
              </div>
            ) : todayStats ? (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {todayStats.totalTokens?.toLocaleString() || 0}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Prompt Tokens</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {todayStats.promptTokens?.toLocaleString() || 0}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Completion Tokens</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {todayStats.completionTokens?.toLocaleString() || 0}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="col-span-3 text-center">No usage data available for today</div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="range">
          <Card>
            <CardHeader>
              <CardTitle>Usage By Date Range</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRangeSubmit} className="mb-6 grid gap-4 md:grid-cols-3">
                <div>
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
                <div>
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
                  <Button type="submit" className="w-full">
                    {usageQuery.isFetching && tabValue === "range" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Generate Report
                  </Button>
                </div>
              </form>

              {tabValue === "range" && (
                <>
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
                            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {usageQuery.data.summary.totalTokens?.toLocaleString() || 0}
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Prompt Tokens</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {usageQuery.data.summary.promptTokens?.toLocaleString() || 0}
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Completion Tokens</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {usageQuery.data.summary.completionTokens?.toLocaleString() || 0}
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
                    <div className="text-center">Please select a date range and generate a report</div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
