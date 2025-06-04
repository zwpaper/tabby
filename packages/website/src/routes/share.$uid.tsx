import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import {
  getGitPlatformIcon,
  parseGitOriginUrl,
} from "@ragdoll/common/git-utils";
import {
  IconBrandBitbucket,
  IconBrandGithub,
  IconBrandGitlab,
} from "@tabler/icons-react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import { Calendar, FolderGitIcon } from "lucide-react";
import moment from "moment";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/share/$uid")({
  component: ThemeWrapped,
  loader: async ({ params }) => {
    const { uid } = params;

    try {
      const resp = await apiClient.api.tasks[":uid"].public.$get({
        param: {
          uid,
        },
      });

      if (!resp.ok) {
        if (resp.status === 404 || resp.status === 403) {
          throw notFound();
        }
        throw new Error(`Failed to load task: ${resp.status}`);
      }

      return resp.json();
    } catch (error) {
      if (error instanceof Error && error.message === "404") {
        throw notFound();
      }
      throw error;
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData.title,
      },
    ],
  }),
});

const isDEV = import.meta.env.DEV;
const webviewOrigin = "http://localhost:4112";

function ThemeWrapped() {
  return (
    <ThemeProvider storageKey="pochi-share-theme" defaultTheme="light">
      <RouteComponent />
    </ThemeProvider>
  );
}

function RouteComponent() {
  const loaderData = Route.useLoaderData();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [iframeError, setIframeError] = useState<Error | undefined>(undefined);
  const [iframeHeight, setIframeHeight] = useState<number>(600); // Default height
  const { theme } = useTheme();

  const displayError = iframeError;

  const iframeUrl = useMemo(() => {
    const hostOrigin = window.location.origin;
    const search = new URLSearchParams({
      logo: `${hostOrigin}/logo192.png`,
    }).toString();

    const hash = new URLSearchParams({
      theme: theme || "light",
    }).toString();

    return isDEV
      ? `${webviewOrigin}/share?${search}#${hash}`
      : `/share.html?${search}#${hash}`;
  }, [theme]);

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

  // Listen for height updates from iframe content
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (isDEV && event.origin !== webviewOrigin) return;
      if (!isDEV && event.origin !== window.location.origin) return;

      if (
        event.data?.type === "resize" &&
        typeof event.data.height === "number"
      ) {
        setIframeHeight(Math.max(event.data.height, 300)); // Minimum height of 300px
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (loaderData && loaded && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow?.postMessage(
        {
          type: "share",
          messages: loaderData.conversation?.messages,
          user: loaderData.user,
          todos: loaderData.todos,
        },
        {
          targetOrigin: isDEV ? webviewOrigin : "/",
        },
      );
    }
  }, [loaderData, loaded]);

  return (
    <div className="mx-auto mt-4 flex max-w-6xl flex-1 flex-col space-y-8">
      {/* Task header */}
      <div className="space-y-4 px-4 pt-2">
        <div className="flex items-start gap-3">
          <div className="flex flex-1 flex-col space-y-3 overflow-hidden pr-8">
            <span className="flex gap-1">
              <h1 className="truncate whitespace-nowrap font-bold text-2xl">
                {loaderData?.title || "Task"}
              </h1>
              <ThemeToggle />
            </span>

            <div className="flex min-h-4 flex-col gap-3 text-muted-foreground text-sm md:flex-row">
              {loaderData?.updatedAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatTime(loaderData.updatedAt, "Updated")}</span>
                </div>
              )}
              <div className="items-center gap-4">
                {loaderData?.git && <GitBadge git={loaderData.git} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {/* Error states */}
        {!!displayError && <ErrorDisplay taskError={null} className="h-full" />}
        <iframe
          ref={iframeRef}
          className={cn("w-full", {
            "hidden h-0": !loaded || displayError,
          })}
          style={{
            height: loaded && !displayError ? `${iframeHeight}px` : "100%",
          }}
          title="task"
          src={iframeUrl}
          scrolling="no"
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
  taskError?: Error | null;
  className?: string;
}

function ErrorDisplay({ taskError, className }: ErrorDisplayProps) {
  const getErrorInfo = () => {
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
      </div>
    </div>
  );
}

function GitBadge({
  className,
  git,
}: { git: Task["git"]; className?: string }) {
  if (!git) return null;

  const repoInfo = parseGitOriginUrl(git.origin);

  const iconMap = {
    github: IconBrandGithub,
    gitlab: IconBrandGitlab,
    bitbucket: IconBrandBitbucket,
    git: FolderGitIcon,
  };

  const IconComponent = repoInfo
    ? iconMap[getGitPlatformIcon(repoInfo.platform)]
    : FolderGitIcon;

  // Display shorthand if available, otherwise fallback to origin/branch
  const displayText = repoInfo
    ? repoInfo.shorthand
    : `${git.origin}/${git.branch}`;

  const badgeContent = (
    <div className={cn("flex flex-col md:flex-row", className)}>
      <span className="flex items-center">
        <IconComponent className="h-4 w-4" />
        <span>{displayText}</span>
      </span>
      <span className="text-muted-foreground/60">@{git.branch}</span>
    </div>
  );

  // If it's a recognized platform with a web URL, make it clickable
  if (repoInfo?.webUrl) {
    return (
      <a
        href={repoInfo.webUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="transition-opacity hover:opacity-80"
        title={`Open ${repoInfo.shorthand} on ${repoInfo.platform}`}
      >
        {badgeContent}
      </a>
    );
  }

  return badgeContent;
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
