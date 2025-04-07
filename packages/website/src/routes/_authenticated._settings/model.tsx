import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton"; // Keep Skeleton for pending state
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/lib/auth-client";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

// Define the route with loader
export const Route = createFileRoute("/_authenticated/_settings/model")({
  async loader() {
    const data = await apiClient.api.models.$get();
    if (data.ok) {
      return { data: await data.json(), error: null };
    }
    return { data: null, error: data.statusText };
  },
  component: ModelsPage,
  pendingComponent: ModelsPending, // Add a pending component
});

// Pending component for loading state
function ModelsPending() {
  return (
    <div className="container max-w-5xl space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Available Models</CardTitle>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to format context window size
function formatContextWindow(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(".0", "")}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1).replace(".0", "")}k`;
  }
  return num.toString();
}

// The React component using loader data
function ModelsPage() {
  const { data: models, error } = Route.useLoaderData();

  const renderModelsTable = () => {
    if (error) {
      return (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-center text-destructive">
          Error loading models: {error}
        </div>
      );
    }

    if (models && models.length > 0) {
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              {/* Updated Headers based on new Model interface */}
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Context Window</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.id}>
                <TableCell className="font-mono text-xs">{model.id}</TableCell>
                {/* Updated Cells based on new Model interface */}
                <TableCell className="font-medium capitalize">
                  <Badge
                    variant={
                      model.costType === "premium" ? "default" : "secondary"
                    }
                  >
                    {model.costType}
                  </Badge>
                </TableCell>
                <TableCell
                  className="text-right"
                  title={model.contextWindow.toLocaleString()}
                >
                  {formatContextWindow(model.contextWindow)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    return (
      <div className="rounded-md border border-border bg-muted/40 p-4 text-center text-muted-foreground">
        No models available.
      </div>
    );
  };

  return (
    <div className="container max-w-5xl space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Available Models</CardTitle>
        </CardHeader>
        <CardContent>{renderModelsTable()}</CardContent>
      </Card>
    </div>
  );
}
