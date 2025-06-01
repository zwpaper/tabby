import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"; // Import pagination components
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiClient } from "@/lib/auth-client";
import { useCurrentWorkspace } from "@/lib/hooks/use-current-workspace";
import { cn } from "@/lib/utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import {
  Brain,
  CheckCircle2,
  Edit3,
  GitBranch,
  HelpCircle,
  Loader2,
  TerminalIcon,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";
import { WorkspaceRequiredPlaceholder } from "../../components/workspace-required-placeholder";

export const Route = createFileRoute("/_auth/tasks")({
  validateSearch: (search: Record<string, unknown>): { page?: number } => {
    return {
      page: Number(search.page ?? 1),
    };
  },
  component: App,
});

const getPaginationItems = (
  currentPage: number,
  totalPages: number,
  onPageChange: (page: number) => void,
) => {
  const items = [];
  const pageLimit = 5; // Max number of page links to show
  const sidePages = 1; // Number of pages to show on each side of current page

  // Previous button
  items.push(
    <PaginationItem key="prev">
      <PaginationPrevious
        onClick={() => onPageChange(currentPage - 1)}
        // @ts-expect-error todo: fix type
        disabled={currentPage <= 1}
        className="px-2 sm:px-2.5"
      />
    </PaginationItem>,
  );

  if (totalPages <= pageLimit) {
    // Show all pages if total pages is less than or equal to limit
    for (let i = 1; i <= totalPages; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            onClick={() => onPageChange(i)}
            isActive={currentPage === i}
          >
            {i}
          </PaginationLink>
        </PaginationItem>,
      );
    }
  } else {
    // Show first page
    items.push(
      <PaginationItem key={1}>
        <PaginationLink
          onClick={() => onPageChange(1)}
          isActive={currentPage === 1}
        >
          1
        </PaginationLink>
      </PaginationItem>,
    );

    // Ellipsis after first page if needed
    if (currentPage > sidePages + 2) {
      items.push(
        <PaginationItem key="ellipsis-start">
          <PaginationEllipsis />
        </PaginationItem>,
      );
    }

    // Pages around current page
    const startPage = Math.max(2, currentPage - sidePages);
    const endPage = Math.min(totalPages - 1, currentPage + sidePages);

    for (let i = startPage; i <= endPage; i++) {
      if (i === 1 || i === totalPages) continue; // Skip if it's the first or last page (already handled)
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            onClick={() => onPageChange(i)}
            isActive={currentPage === i}
          >
            {i}
          </PaginationLink>
        </PaginationItem>,
      );
    }

    // Ellipsis before last page if needed
    if (currentPage < totalPages - sidePages - 1) {
      items.push(
        <PaginationItem key="ellipsis-end">
          <PaginationEllipsis />
        </PaginationItem>,
      );
    }

    // Show last page
    items.push(
      <PaginationItem key={totalPages}>
        <PaginationLink
          onClick={() => onPageChange(totalPages)}
          isActive={currentPage === totalPages}
        >
          {totalPages}
        </PaginationLink>
      </PaginationItem>,
    );
  }

  // Next button
  items.push(
    <PaginationItem key="next">
      <PaginationNext
        onClick={() => onPageChange(currentPage + 1)}
        // @ts-expect-error todo: fix type
        disabled={currentPage >= totalPages}
        className="px-2 sm:px-2.5"
      />
    </PaginationItem>,
  );

  return items;
};

function App() {
  const { data: currentWorkspace, isFetching } = useCurrentWorkspace();
  if (isFetching) {
    return;
  }

  if (!currentWorkspace) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center">
        <WorkspaceRequiredPlaceholder isFetching={isFetching} />
      </div>
    );
  }

  return <Tasks cwd={currentWorkspace} />;
}

function Tasks({ cwd }: { cwd: string }) {
  const limit = 20;
  const router = useRouter();
  const { page = 1 } = Route.useSearch();

  const { data, isPlaceholderData, isLoading, isRefetching } = useQuery({
    queryKey: ["tasks", page, limit, cwd],
    queryFn: () =>
      apiClient.api.tasks
        .$get({
          query: {
            page: page.toString(),
            limit: limit.toString(),
            cwd,
          },
        })
        .then((x) => x.json()),
    placeholderData: keepPreviousData,
  });

  const tasks = data?.data || [];
  const meta = data?.pagination; // Adjusted to use 'pagination' from API response
  const isRefetchingFirstPage = !isLoading && isRefetching && page === 1;

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || (meta?.totalPages && newPage > meta.totalPages)) return;
    router.navigate({
      to: "/tasks",
      search: (prev) => ({ ...prev, page: newPage }),
    });
  };

  if (!isLoading && tasks.length === 0) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center">
        <EmptyTaskPlaceholder />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col">
      {/* Main content area with scroll */}
      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-4 p-4 pb-6">
            {isRefetchingFirstPage && (
              <div className="flex justify-center">
                <Loader2 className="size-6 animate-spin" />
              </div>
            )}
            {isPlaceholderData || isLoading
              ? [...Array(limit)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-lg border border-border/50 border-l-4 border-l-muted-foreground/50 bg-card"
                  >
                    <div className="px-4 py-3">
                      <div className="mb-1 flex items-start justify-between">
                        <div className="h-3 w-32 rounded bg-card/70" />
                        <div className="h-5 w-5 rounded bg-card/70" />
                      </div>
                      <div className="h-5 w-3/4 rounded bg-card/70" />
                    </div>
                  </div>
                ))
              : tasks.map((task) => <TaskRow key={task.id} task={task} />)}
          </div>
        </ScrollArea>
      </div>

      {/* Pagination footer */}
      {meta?.totalPages && meta.totalPages > 1 && (
        <div className="flex-shrink-0 border-border/50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="px-3 py-2.5 sm:px-4 sm:py-3">
            <Pagination>
              <PaginationContent className="gap-0.5 sm:gap-1">
                {getPaginationItems(page, meta.totalPages, handlePageChange)}
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyTaskPlaceholder() {
  const { navigate } = useRouter();
  return (
    <div className="flex h-full select-none flex-col items-center justify-center p-5 text-center text-gray-500 dark:text-gray-300">
      <h2 className="mb-2 flex items-center gap-3 font-semibold text-2xl text-gray-700 dark:text-gray-100">
        <TerminalIcon />
        No tasks found
      </h2>
      <p className="mb-4 leading-relaxed">
        Create a new task to get started with Pochi
      </p>
      <Button
        onClick={() => navigate({ to: "/" })}
        variant="ghost"
        className="mb-20"
      >
        <Zap className="size-4" />
        Create New Task
      </Button>
    </div>
  );
}

const TaskStatusIcon = ({ status }: { status: string }) => {
  const iconProps = { className: "size-5 text-muted-foreground" };
  switch (status) {
    case "streaming":
      return <Zap {...iconProps} aria-label="Streaming" />;
    case "pending-tool":
      return <Wrench {...iconProps} aria-label="Pending Tool" />;
    case "pending-input":
      return <Edit3 {...iconProps} aria-label="Pending Input" />;
    case "completed":
      return <CheckCircle2 {...iconProps} aria-label="Completed" />;
    case "failed":
      return <XCircle {...iconProps} aria-label="Failed" />;
    case "pending-model":
      return <Brain {...iconProps} aria-label="Pending Model" />;
    default:
      return (
        <HelpCircle {...iconProps} aria-label={`Unknown Status: ${status}`} />
      );
  }
};

const getStatusBorderColor = (status: string): string => {
  switch (status) {
    case "streaming":
      return "border-l-muted-foreground/60";
    case "pending-tool":
      return "border-l-muted-foreground/60";
    case "pending-input":
      return "border-l-muted-foreground/60";
    case "completed":
      return "border-l-muted-foreground/30";
    case "failed":
      return "border-l-muted-foreground/80";
    default:
      return "border-l-muted-foreground/50";
  }
};

type Task = NonNullable<
  InferResponseType<(typeof apiClient.api.tasks)["$get"]>
>["data"][number];

function TaskRow({ task }: { task: Task }) {
  return (
    <Link
      to={"/"}
      search={{ taskId: task.id }}
      className="group cursor-pointer"
    >
      <div
        className={cn(
          "cursor-pointer rounded-lg border border-border/50 bg-card transition-all duration-200 hover:border-border hover:bg-card/90 hover:shadow-md",
          "border-l-4",
          getStatusBorderColor(task.status),
        )}
      >
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {task.git ? (
                <>
                  <div className="mb-1 flex items-start justify-between">
                    <GitBadge
                      git={task.git}
                      className="text-muted-foreground/80 text-xs"
                    />
                    <TaskStatusIcon status={task.status} />
                  </div>
                  <h3 className="line-clamp-2 font-medium text-foreground leading-relaxed transition-colors duration-200 group-hover:text-foreground/80">
                    {task.title}
                  </h3>
                </>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <h3 className="line-clamp-2 flex-1 font-medium text-foreground leading-relaxed transition-colors duration-200 group-hover:text-foreground/80">
                    {task.title}
                  </h3>
                  <TaskStatusIcon status={task.status} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function GitBadge({
  className,
  git,
}: { git: Task["git"]; className?: string }) {
  if (!git) return null;

  return (
    <Badge
      variant="outline"
      className={cn("border-none p-0 text-foreground", className)}
    >
      <GitBranch />
      {git.branch}
    </Badge>
  );
}
