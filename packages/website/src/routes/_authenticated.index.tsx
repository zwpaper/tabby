import { columns } from "@/components/tasks/columns";
import { DataTable } from "@/components/tasks/data-table";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { apiClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  component: TaskPage,
});

function TaskPage() {
  const page = 1;
  const limit = 100;
  const { data, isLoading } = useQuery({
    queryKey: ["tasks", page, limit],
    queryFn: () =>
      apiClient.api.tasks
        .$get({ query: { page: page.toString(), limit: limit.toString() } })
        .then((x) => x.json()),
  });

  const tasks = data?.data || [];

  return (
    <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex max-w-6xl mx-auto">
      <h3 className="text-lg">Tasks</h3>
      {isLoading ? <Loading /> : <DataTable data={tasks} columns={columns} />}
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-4">
      {/* Skeleton for Toolbar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-8 w-[150px]" />
      </div>
      {/* Skeleton for Table */}
      <div className="rounded-md border">
        <div className="w-full">
          {/* Skeleton for Table Header */}
          <div className="flex border-b">
            {columns.map((column) => (
              <div key={column.id} className="p-4 flex-1">
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
          {/* Skeleton for Table Body */}
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex border-b">
                {columns.map((column) => (
                  <div key={column.id} className="p-4 flex-1">
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-[100px]" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}
