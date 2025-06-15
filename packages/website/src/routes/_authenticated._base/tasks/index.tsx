import { TaskRow } from "@/components/tasks/task-row";
import { DataTablePagination } from "@/components/tasks/tasks-pagination";

import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/auth-client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";

import { z } from "zod";

const taskSearchSchema = z.object({
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(20).max(50).optional().default(20),
});

export const Route = createFileRoute("/_authenticated/_base/tasks/")({
  component: TaskPage,
  validateSearch: (search) => taskSearchSchema.parse(search),
});

function TaskPage() {
  const router = useRouter();
  const { page, limit } = Route.useSearch();
  const { data, isLoading } = useQuery({
    queryKey: ["tasks", page, limit],
    queryFn: () =>
      apiClient.api.tasks
        .$get({ query: { page: page.toString(), limit: limit.toString() } })
        .then((x) => x.json()),
    placeholderData: keepPreviousData,
  });

  const tasks = data?.data || [];
  const totalPages = data?.pagination?.totalPages || 1;

  const onPageChange = (page: number) => {
    router.navigate({
      to: "/tasks",
      search: {
        limit,
        page,
      },
    });
  };

  const onLimitChange = (newLimit: number) => {
    router.navigate({
      to: "/tasks",
      search: {
        limit: newLimit,
        page: 1, // Reset to page 1 when limit changes
      },
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto h-full max-w-6xl flex-1 flex-col space-y-8 px-2 pt-0 pb-8 md:flex md:px-6">
        <Loading />
      </div>
    );
  }

  return (
    <div className="mx-auto h-full max-w-6xl flex-1 flex-col space-y-8 px-2 pt-0 pb-8 md:flex md:px-6">
      <div className="space-y-4">
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskRow key={task.uid} task={task} />
          ))}
        </div>
        <DataTablePagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          limit={limit}
          onLimitChange={onLimitChange}
        />
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[78px] w-full" />
        ))}
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
