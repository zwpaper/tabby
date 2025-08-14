import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { UIMessage } from "@ai-v5-sdk/ai";
import type { Todo } from "@getpochi/tools";
import type { TaskError } from "@ragdoll/db";
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const isDEV = import.meta.env.DEV;
const webviewOrigin = "http://localhost:4112";

interface ContentProps extends ComponentProps<"div"> {
  messages?: UIMessage[] | null;
  todos?: Todo[] | null;
  user?: {
    name: string;
    image?: string | null;
  };
  assistant?: {
    name: string;
    image?: string | null;
  };
  theme?: string;
  isLoading?: boolean;
  error?: TaskError | null;
}

function TaskContent({
  messages,
  todos,
  assistant: originalAssistant,
  user,
  theme,
  className,
  isLoading,
  error,
  ...props
}: ContentProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [iframeError, setIframeError] = useState<Error | undefined>(undefined);
  const [iframeHeight, setIframeHeight] = useState<number>(600); // Default height
  const [isIframeInitialized, setIsIframeInitialized] = useState(false);

  const displayError = iframeError;

  const assistant = useMemo(() => {
    const hostOrigin = window.location.origin;
    if (!originalAssistant) {
      return {
        name: "Pochi",
        image: `${hostOrigin}/logo192.png`,
      };
    }
    return {
      ...originalAssistant,
      image: originalAssistant.image
        ? new URL(originalAssistant.image, hostOrigin).href
        : "",
    };
  }, [originalAssistant]);

  const iframeUrl = useMemo(() => {
    const search = new URLSearchParams({
      assistant_name: assistant.name,
      assistant_image: assistant.image ?? "",
    }).toString();

    const hash = new URLSearchParams({
      theme: theme || "light",
    }).toString();

    return isDEV
      ? `${webviewOrigin}/share?${search}#${hash}`
      : `/share.html?${search}#${hash}`;
  }, [theme, assistant]);

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

      if (event.data?.type === "messagesLoaded") {
        setIsIframeInitialized(true);
      }

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
    if (loaded && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow?.postMessage(
        {
          type: "share",
          messages: messages,
          user,
          assistant,
          todos,
          isLoading,
          error,
        },
        {
          targetOrigin: isDEV ? webviewOrigin : "/",
        },
      );
    }
  }, [messages, todos, isLoading, user, assistant, loaded, error]);

  return (
    <div className={cn("flex flex-1 flex-col", className)} {...props}>
      {/* Skeleton Loader */}
      {!isIframeInitialized && !displayError && <MessageContentSkeleton />}
      {/* Error states */}
      {!!displayError && <ErrorDisplay taskError={null} className="h-full" />}
      <iframe
        ref={iframeRef}
        className={cn("w-full", {
          hidden: !isIframeInitialized || displayError,
        })}
        style={{
          height:
            isIframeInitialized && !displayError ? `${iframeHeight}px` : 0,
        }}
        title="task"
        src={iframeUrl}
        scrolling="no"
        onError={handleIframeError}
        onLoad={handleIframeLoad}
      />
    </div>
  );
}

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

function MessageContentSkeleton() {
  return (
    <div className="animate-pulse space-y-2 p-4">
      {/* Avatar and Name */}
      <div className="flex items-center space-x-3">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
      {/* Simplified text lines for main content */}
      <div className="space-y-2 pt-1">
        <Skeleton className="h-4 w-[80%]" />
        <Skeleton className="h-4 w-[50%]" />
      </div>
      {/* Avatar and Name */}
      <div className="mt-8 flex items-center space-x-3">
        <div className="flex items-center space-x-3">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <div className="space-y-2 pt-1">
        <Skeleton className="h-4 w-[80%]" />
        <Skeleton className="h-4 w-[80%]" />
        <Skeleton className="h-4 w-[50%]" />
      </div>
    </div>
  );
}

export { TaskContent, ErrorDisplay, MessageContentSkeleton };
