import { columns } from "@/components/tasks/columns";
import { DataTable } from "@/components/tasks/data-table";
import { apiClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  component: TaskPage,
});

function TaskPage() {
  const page = 1;
  const limit = 10;
  const { data, isLoading, error, isError } = useQuery({
    queryKey: ["tasks", page, limit],
    queryFn: () =>
      apiClient.api.tasks
        .$get({ query: { page: page.toString(), limit: limit.toString() } })
        .then((x) => x.json()),
  });

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error: {error.message}</div>;

  const tasks = data?.data || [];

  return (
    <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex max-w-6xl mx-auto">
      <h3 className="text-lg">Tasks</h3>
      <DataTable data={tasks} columns={columns} />
    </div>
  );
}
