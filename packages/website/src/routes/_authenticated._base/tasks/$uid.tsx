import { ErrorDisplay, TaskContent } from "@/components/task/content";
import { TaskHeader } from "@/components/task/header";
import { TaskPageSkeleton } from "@/components/task/skeleton";
import { apiClient } from "@/lib/auth-client";
import { createFileRoute, notFound } from "@tanstack/react-router";

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
  pendingComponent: TaskPageSkeleton,
  errorComponent: ({ error }) => <ErrorDisplay taskError={error} />,
});

function RouteComponent() {
  const loaderData = Route.useLoaderData();
  const { auth } = Route.useRouteContext();

  return (
    <div className="mx-auto flex max-w-6xl flex-1 flex-col space-y-8">
      {/* Task header */}
      <TaskHeader>
        <TaskHeader.Title title={loaderData?.title} />
        <TaskHeader.Subtitle
          updatedAt={loaderData?.updatedAt}
          git={loaderData?.git}
        />
      </TaskHeader>

      <TaskContent
        conversation={loaderData.conversation}
        todos={loaderData.todos}
        user={auth.user}
      />
    </div>
  );
}
