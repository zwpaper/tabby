import { AccessControlButton } from "@/components/task/access-control-button";
import { TaskContent } from "@/components/task/content";
import { TaskHeader } from "@/components/task/header";
import { OpenInIdeButton } from "@/components/task/open-in-ide-button";
import { TaskPageSkeleton } from "@/components/task/skeleton";
import { useTheme } from "@/components/theme-provider";
import { usePochiEvents } from "@/hooks/use-pochi-events";
import { apiClient } from "@/lib/auth-client";
import { normalizeApiError, toHttpError } from "@/lib/error";
import { inlineSubTasks } from "@/lib/inline-sub-task";
import { toUIMessages } from "@ragdoll/common";
import type { TaskEvent } from "@ragdoll/db";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/_base/tasks/$uid")({
  component: RouteComponent,
  loader: async ({ params }) => {
    const { uid } = params;

    try {
      const resp = await apiClient.api.tasks[":uid"].$get({
        param: {
          uid,
        },
        query: {
          includeSubTasks: "true",
        },
      });

      if (!resp.ok) {
        throw toHttpError(resp);
      }

      const json = await resp.json();
      return json;
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
  pendingComponent: TaskPageSkeleton,
});

const getIsLoading = (status: string) =>
  status !== "pending-input" && status !== "completed";

function RouteComponent() {
  const loaderData = Route.useLoaderData();
  const { auth } = Route.useRouteContext();
  const { uid } = Route.useParams();
  const router = useRouter();
  const { theme } = useTheme();

  const [isLoading, setIsLoading] = useState(() =>
    getIsLoading(loaderData.status),
  );

  const pochiEventCallback = useCallback(
    (event: TaskEvent) => {
      // The event source is already scoped to the UID on the server,
      // but we can add a check for robustness.
      if (event.data.uid === uid) {
        setIsLoading(getIsLoading(event.data.status));
        router.invalidate();
      }
    },
    [uid, router],
  );

  usePochiEvents<TaskEvent>(uid, "task:status-changed", pochiEventCallback);

  const renderMessages = useMemo(() => {
    const dbMessages = loaderData.conversation?.messages ?? [];
    const subtasks = loaderData.subtasks ?? [];
    return inlineSubTasks(toUIMessages(dbMessages), subtasks);
  }, [loaderData]);

  return (
    <div className="mx-auto flex max-w-6xl flex-1 flex-col space-y-8">
      <TaskHeader
        actions={
          <span className="hidden items-center gap-1 md:flex [&>button]:min-w-20">
            <OpenInIdeButton
              uid={loaderData.uid}
              minionId={loaderData.minionId}
            />
            <AccessControlButton
              uid={loaderData.uid}
              isPublicShared={loaderData.isPublicShared}
            />
          </span>
        }
      >
        <TaskHeader.Title title={loaderData.title} />
        <TaskHeader.Subtitle
          updatedAt={loaderData.updatedAt}
          git={loaderData.git}
        />
      </TaskHeader>

      <TaskContent
        messages={renderMessages}
        todos={loaderData.todos}
        user={auth.user}
        theme={theme}
        isLoading={isLoading}
      />
    </div>
  );
}
