import { AccessControlButton } from "@/components/task/access-control-button";
import { TaskContent } from "@/components/task/content";
import { DeleteTaskButton } from "@/components/task/delete-task-button";
import { TaskHeader } from "@/components/task/header";
import { OpenInIdeButton } from "@/components/task/open-in-ide-button";
import { TaskPageSkeleton } from "@/components/task/skeleton";
import { useTheme } from "@/components/theme-provider";
import { usePochiEvents } from "@/hooks/use-pochi-events";
import { apiClient } from "@/lib/auth-client";
import { normalizeApiError, toHttpError } from "@/lib/error";
import { inlineSubTasks } from "@/lib/inline-sub-task";
import type { SubTask } from "@getpochi/tools";
import type { TaskEvent } from "@ragdoll/db";
import type { Message } from "@ragdoll/livekit";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

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

      return await resp.json();
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

function RouteComponent() {
  const loaderData = Route.useLoaderData();
  const { auth } = Route.useRouteContext();
  const { uid } = Route.useParams();
  const router = useRouter();
  const { theme } = useTheme();

  const pochiEventCallback = useCallback(
    (event: TaskEvent) => {
      // The event source is already scoped to the UID on the server,
      // but we can add a check for robustness.
      if (event.data.uid === uid) {
        router.invalidate();
      }
    },
    [uid, router],
  );

  usePochiEvents<TaskEvent>(uid, "task:status-changed", pochiEventCallback);

  const isLoading = useMemo(() => {
    if (!loaderData) return false;
    return !["pending-input", "completed", "failed", "pending-tool"].includes(
      loaderData.status,
    );
  }, [loaderData]);

  // @ts-ignore
  const messages: Message[] = loaderData.conversation?.messagesNext || [];
  // @ts-ignore
  const subtasks: SubTask[] =
    loaderData.subtasks?.map((subtask) => {
      return {
        uid: subtask.uid,
        clientTaskId: subtask.clientTaskId,
        messages: subtask.conversation?.messagesNext || [],
        todos: subtask.todos,
      };
    }) ?? [];

  const renderMessages =
    messages.length > 0 && subtasks.length > 0
      ? inlineSubTasks(messages, subtasks)
      : messages;

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
            <DeleteTaskButton uid={loaderData.uid} />
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
        theme={theme}
        messages={renderMessages}
        todos={loaderData.todos}
        error={loaderData.error}
        isLoading={isLoading}
        user={auth.user}
      />
    </div>
  );
}
