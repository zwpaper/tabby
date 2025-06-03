import { statuses } from "@/components/tasks/constants";
import { apiClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { formatTaskId } from "@/lib/utils/task";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import { ArrowLeft, Calendar, GitBranch, Loader2 } from "lucide-react";
import moment from "moment";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const isDEV = import.meta.env.DEV;
const webviewOrigin = "http://localhost:4112";

export const Route = createFileRoute("/_authenticated/tasks/$taskId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { taskId } = Route.useParams();
  const {
    auth: { user },
  } = Route.useRouteContext();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [iframeError, setIframeError] = useState<Error | undefined>(undefined);

  // Check if taskId is valid (numeric)
  const isValidTaskId = !Number.isNaN(Number.parseInt(taskId));
  const taskIdError = useMemo(() => {
    return !isValidTaskId ? new Error("404") : undefined;
  }, [isValidTaskId]);

  const {
    data: loaderData,
    isFetching,
    error: taskError,
  } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const resp = await apiClient.api.tasks[":id"].$get({
        param: {
          id: taskId,
        },
      });
      if (!resp.ok) {
        if (resp.status === 404) {
          throw new Error("404");
        }
        throw new Error(`Failed to load task: ${resp.status}`);
      }
      return resp.json();
    },
    refetchOnWindowFocus: false,
    enabled: isValidTaskId,
  });

  const displayError = taskIdError || taskError || iframeError;

  const iframeUrl = useMemo(() => {
    const hostOrigin = window.location.origin;
    const search = new URLSearchParams({
      theme: "light",
      logo: `${hostOrigin}/logo192.png`,
    }).toString();

    return isDEV ? `${webviewOrigin}/share?${search}` : `/share.html?${search}`;
  }, []);

  const handleIframeError = useCallback(
    (event: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
      const errorMessage =
        event.nativeEvent?.type === "error"
          ? "Failed to load iframe content"
          : "Unknown iframe error";
      setIframeError(new Error(errorMessage));
      setLoaded(false);
    },
    [],
  );

  const handleIframeLoad = useCallback(
    (_event: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
      setLoaded(true);
      setIframeError(undefined);
    },
    [],
  );

  useEffect(() => {
    if (loaderData && loaded && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow?.postMessage(
        {
          type: "share",
          messages: loaderData.conversation?.messages,
          // FIXME: todo should be the task owner
          user,
        },
        {
          targetOrigin: isDEV ? webviewOrigin : "/",
        },
      );
    }
  }, [loaderData, loaded, user]);

  return (
    <div className="mx-auto hidden h-screen max-w-6xl flex-1 flex-col space-y-8 p-8 md:flex">
      {/* Task header */}
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex items-center justify-center rounded-md border border-input bg-background p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex flex-1 flex-col space-y-3 overflow-hidden pr-8">
            <h1 className="truncate whitespace-nowrap font-bold text-2xl">
              {taskIdError
                ? "Task"
                : loaderData?.title || formatTaskId(Number.parseInt(taskId))}
            </h1>

            <div className="flex min-h-4 items-center justify-between gap-3 text-muted-foreground text-sm">
              <div className="flex items-center gap-4">
                {loaderData?.git && <GitBadge git={loaderData.git} />}
                {loaderData?.status && (
                  <StatusBadge status={loaderData.status} />
                )}
              </div>
              {loaderData?.createdAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatTime(loaderData.createdAt, "Created")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {/* Error states */}
        {!!displayError && (
          <ErrorDisplay
            taskIdError={taskIdError}
            taskError={taskError}
            className="h-full"
          />
        )}
        {/* Loading state */}
        {isFetching && !loaderData && !displayError && (
          <div className="flex h-full items-center justify-center">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          className={cn("h-full w-full", {
            "hidden h-0":
              !loaded || displayError || (isFetching && !loaderData),
          })}
          title="task"
          src={iframeUrl}
          onError={handleIframeError}
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
}

type Task = NonNullable<
  InferResponseType<(typeof apiClient.api.tasks)["$get"]>
>["data"][number];

interface ErrorDisplayProps {
  taskIdError?: Error;
  taskError?: Error | null;
  className?: string;
}

function ErrorDisplay({
  taskIdError,
  taskError,
  className,
}: ErrorDisplayProps) {
  const getErrorInfo = () => {
    if (taskIdError) {
      return {
        title: "404",
        message:
          "Oops, it looks like the page you're looking for doesn't exist.",
        type: "404" as const,
      };
    }

    if (taskError) {
      const isNotFound =
        taskError.message?.includes("not found") ||
        taskError.message?.includes("404") ||
        taskError.message?.includes("403");

      if (isNotFound) {
        return {
          title: "404",
          message:
            "Oops, it looks like the page you're looking for doesn't exist.",
          type: "404" as const,
          canRetry: false,
        };
      }

      return {
        title: "Failed to fetch",
        message:
          taskError.message ||
          "An unexpected error occurred while loading the task.",
        description: "This might be a temporary issue. Please try again.",
        type: "task-error" as const,
        canRetry: true,
      };
    }

    return {
      title: "Something went wrong",
      message: "An unexpected error occurred.",
      description: "Please try again or contact support if the issue persists.",
      type: "unknown" as const,
      canRetry: false,
    };
  };

  const errorInfo = getErrorInfo();

  return (
    <div className={cn("flex h-[80vh] items-center justify-center", className)}>
      <div className="mx-auto space-y-6 text-center">
        <div className="space-y-3">
          <div className="space-y-2">
            <h2 className="font-semibold text-5xl text-foreground">
              {errorInfo.title}
            </h2>
            <p className="text-muted-foreground">{errorInfo.message}</p>
            {errorInfo.description && (
              <p className="text-muted-foreground text-sm">
                {errorInfo.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function GitBadge({
  className,
  git,
}: { git: Task["git"]; className?: string }) {
  if (!git) return null;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <GitBranch className="h-4 w-4" />
      <span>
        {git.origin}/{git.branch}
      </span>
    </div>
  );
}

function StatusBadge({
  status,
  className,
}: { status: Task["status"]; className?: string }) {
  const statusInfo = statuses.find((s) => s.value === status);

  if (!statusInfo) return null;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {statusInfo.icon && <statusInfo.icon className="h-4 w-4" />}
      <span>{statusInfo.label}</span>
    </div>
  );
}

function formatTime(time: string, prefix: string) {
  const targetTime = moment(time);

  if (targetTime.isBefore(moment().subtract(1, "year"))) {
    const timeText = targetTime.format("MMM D, YYYY");
    return `${prefix} on ${timeText}`;
  }

  if (targetTime.isBefore(moment().subtract(1, "month"))) {
    const timeText = targetTime.format("MMM D");
    return `${prefix} on ${timeText}`;
  }

  return `${prefix} ${targetTime.fromNow()}`;
}
