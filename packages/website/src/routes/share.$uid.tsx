import { TaskContent } from "@/components/task/content";
import { TaskHeader } from "@/components/task/header";
import { TaskPageSkeleton } from "@/components/task/skeleton";
import { useTheme } from "@/components/theme-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiClient } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-hooks";
import { normalizeApiError, toHttpError } from "@/lib/error";
import { inlineSubTasks } from "@/lib/inline-sub-task";
import { cn } from "@/lib/utils";
import { toUIMessages } from "@ragdoll/common";
import type { SubTask } from "@ragdoll/tools";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

const Skeleton = () => <TaskPageSkeleton className="mt-4 md:mt-6" />;

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
        throw toHttpError(resp);
      }

      const { subtasks, ...rest } = await resp.json();
      return {
        ...rest,
        subtasks: subtasks?.map(
          (x) =>
            ({
              uid: x.uid,
              messages: toUIMessages(x.conversation?.messages || []),
              todos: x.todos || [],
            }) satisfies SubTask,
        ),
      };
    } catch (error) {
      throw normalizeApiError(error);
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData.title,
      },
    ],
  }),
  pendingComponent: Skeleton,
});

function ThemeWrapped() {
  return (
    <ThemeProvider storageKey="pochi-share-theme" defaultTheme="light">
      <RouteComponent />
    </ThemeProvider>
  );
}

function RouteComponent() {
  const loaderData = Route.useLoaderData();
  const { theme } = useTheme();

  const renderMessages = useMemo(() => {
    const dbMessages = loaderData.conversation?.messages ?? [];
    const subtasks = loaderData.subtasks ?? [];
    return inlineSubTasks(toUIMessages(dbMessages), subtasks);
  }, [loaderData]);

  return (
    <div className="mx-auto mt-4 flex max-w-6xl flex-1 flex-col space-y-8 md:mt-6">
      {/* Task header */}
      <TaskHeader>
        <TaskHeader.Title title={loaderData.title}>
          <ThemeToggle />
        </TaskHeader.Title>
        <TaskHeader.Subtitle
          updatedAt={loaderData.updatedAt}
          git={loaderData.git}
        >
          <WaitlistButton />
        </TaskHeader.Subtitle>
      </TaskHeader>

      <TaskContent
        messages={renderMessages}
        todos={loaderData.todos}
        user={loaderData.user}
        theme={theme}
      />
    </div>
  );
}

function WaitlistButton() {
  const { data: auth } = useSession();
  const [showButton, setShowButton] = useState(false);
  const isAuthenticated = !!auth?.user;

  useEffect(() => {
    if (isAuthenticated) return;

    const timer = setTimeout(() => {
      setShowButton(true);
    }, 2_000); // 2 seconds

    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  if (isAuthenticated || !showButton) return;

  return (
    <Link
      to="/"
      className={cn(
        "font-medium text-xs",
        "fade-in-0 slide-in-from-bottom-2 animate-in",
        "transition-all duration-500 ease-out",
        "opacity-80 hover:opacity-100",
      )}
    >
      ✨ Get Pochi!
    </Link>
  );
}
