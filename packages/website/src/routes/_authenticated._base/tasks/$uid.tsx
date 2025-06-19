import { AccessControlButton } from "@/components/task/access-control-button";
import { TaskContent } from "@/components/task/content";
import { TaskHeader } from "@/components/task/header";
import { OpenInIdeButton } from "@/components/task/open-in-ide-button";
import { TaskPageSkeleton } from "@/components/task/skeleton";
import { useTheme } from "@/components/theme-provider";
import { apiClient } from "@/lib/auth-client";
import { normalizeApiError, toHttpError } from "@/lib/error";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_base/tasks/$uid")({
  component: RouteComponent,
  loader: async ({ params }) => {
    const { uid } = params;

    try {
      const resp = await apiClient.api.tasks[":uid"].$get({
        param: {
          uid,
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

function RouteComponent() {
  const loaderData = Route.useLoaderData();
  const { auth } = Route.useRouteContext();
  const { theme } = useTheme();

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
        conversation={loaderData.conversation}
        todos={loaderData.todos}
        user={auth.user}
        theme={theme}
      />
    </div>
  );
}
