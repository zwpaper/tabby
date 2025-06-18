import { DataTablePagination } from "@/components/data-table-pagination";
import type { Repository } from "@/components/tasks/task-filters";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskRow } from "@/components/tasks/task-row";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/auth-client";
import { parseGitOriginUrl } from "@ragdoll/common/git-utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { go as fuzzy } from "fuzzysort";
import { useMemo } from "react";
import { z } from "zod";

const taskSearchSchema = z.object({
  page: z.number().min(1).optional().default(1),
  pageSize: z.number().min(10).max(50).optional().default(20),
  repository: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/_base/tasks/")({
  component: TaskPage,
  validateSearch: (search) => taskSearchSchema.parse(search),
});

const limit = 100;

function TaskPage() {
  const router = useRouter();
  const { page, pageSize, repository, q } = Route.useSearch();
  const { data, isLoading } = useQuery({
    queryKey: ["tasks", 1, limit],
    queryFn: () =>
      apiClient.api.tasks
        .$get({
          query: { page: "1", limit: limit.toString() },
        })
        .then((x) => x.json()),
    placeholderData: keepPreviousData,
  });

  const allTasks = data?.data || [];

  const processedTasks = useMemo(() => {
    return allTasks.map((task) => ({
      ...task,
      repoInfo: task.git?.origin ? parseGitOriginUrl(task.git.origin) : null,
    }));
  }, [allTasks]);

  const repositories = useMemo<Repository[]>(() => {
    const repoMap = new Map<string, Repository>();
    repoMap.set("all", { id: "all", name: "All Repositories" });

    for (const task of processedTasks) {
      if (task.repoInfo) {
        const repoId = `${task.repoInfo.platform}:${task.repoInfo.shorthand}`;
        if (!repoMap.has(repoId)) {
          repoMap.set(repoId, {
            id: repoId,
            name: task.repoInfo.shorthand,
            platform: task.repoInfo.platform,
          });
        }
      }
    }

    return Array.from(repoMap.values());
  }, [processedTasks]);

  const { tasks: filteredTasks, fuzzyResultMap } = useMemo(() => {
    let tasks = processedTasks;
    let fuzzyResultMap: Record<string, Fuzzysort.Result> = {};

    if (repository && repository !== "all") {
      tasks = tasks.filter(
        (task) =>
          task.repoInfo &&
          `${task.repoInfo.platform}:${task.repoInfo.shorthand}` === repository,
      );
    }

    if (q) {
      const result = fuzzy(q, tasks, {
        key: (item) => item.title,
        threshold: 0.3,
      });
      fuzzyResultMap = result.reduce(
        (acc, item) => {
          acc[item.obj.uid] = item;
          return acc;
        },
        {} as Record<string, Fuzzysort.Result>,
      );
      tasks = tasks.filter((task) => fuzzyResultMap[task.uid]);
    }

    return { tasks, fuzzyResultMap };
  }, [processedTasks, repository, q]);

  const totalPages = Math.ceil(filteredTasks.length / pageSize);
  const tasks = filteredTasks.slice((page - 1) * pageSize, page * pageSize);

  const onFilterChange = (newFilters: {
    repository?: string;
    q?: string;
  }) => {
    router.navigate({
      to: "/tasks",
      search: (prev) => ({
        ...prev,
        ...newFilters,
        q: newFilters.q || undefined,
        page: 1,
        pageSize: prev.pageSize ?? 20,
      }),
      replace: true,
    });
  };

  const onPageChange = (page: number) => {
    router.navigate({
      to: "/tasks",
      search: (prev) => ({ ...prev, page, pageSize: prev.pageSize ?? 20 }),
      replace: true,
    });
  };

  const onPageSizeChange = (newPageSize: number) => {
    router.navigate({
      to: "/tasks",
      search: (prev) => ({
        ...prev,
        pageSize: newPageSize,
        page: 1,
      }),
      replace: true,
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto h-full max-w-6xl flex-1 flex-col space-y-8 px-2 pt-6 pb-8 md:flex md:px-6 md:pt-8">
        <div className="space-y-6">
          <TaskFilters
            repositories={[{ id: "all", name: "All Repositories" }]}
            onRepositoryChange={() => {}}
            onSearchChange={() => {}}
            initialRepository="all"
          />
          <Loading />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto h-full max-w-6xl flex-1 flex-col space-y-8 px-2 pt-6 pb-8 md:flex md:px-6 md:pt-8">
      <div className="space-y-6">
        <TaskFilters
          repositories={repositories}
          initialRepository={repository}
          initialSearch={q}
          onRepositoryChange={(repo) => onFilterChange({ repository: repo })}
          onSearchChange={(s) => onFilterChange({ q: s })}
        />
        <div className="space-y-4">
          {allTasks.length === 0 ? (
            <EmptyState
              title="No tasks yet"
              description="It looks like you haven't created any tasks. Get started by creating a new task."
            />
          ) : tasks.length > 0 ? (
            <>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <TaskRow
                    key={task.uid}
                    task={task}
                    fuzzyResult={fuzzyResultMap[task.uid]}
                  />
                ))}
              </div>
              {totalPages > 1 && (
                <DataTablePagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={onPageChange}
                  pageSize={pageSize}
                  onPageSizeChange={onPageSizeChange}
                />
              )}
            </>
          ) : (
            <EmptyState
              title="No tasks found"
              description="Try adjusting your filters to find what you're looking for."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
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

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-lg bg-muted/50 py-12 text-center">
      <h2 className="mb-4 font-bold text-2xl">{title}</h2>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
