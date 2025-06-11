import { ChatPage } from "@/features/chat";
import { apiClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import "@/components/prompt-form/prompt-form.css";

const searchSchema = z.object({
  uid: z.string().optional(),
  ts: z.number().optional(),
});

export const Route = createFileRoute("/_auth/")({
  validateSearch: (search) => searchSchema.parse(search),
  component: RouteComponent,
});

function RouteComponent() {
  const { uid: uidFromRoute, ts = Date.now() } = Route.useSearch();
  const key = uidFromRoute !== undefined ? `task-${uidFromRoute}` : `new-${ts}`;

  const { data: task, isFetching: isTaskLoading } = useQuery({
    queryKey: ["task", uidFromRoute],
    queryFn: async () => {
      if (uidFromRoute) {
        const resp = await apiClient.api.tasks[":uid"].$get({
          param: {
            uid: uidFromRoute,
          },
        });
        return resp.json();
      }
      return null;
    },
    refetchOnWindowFocus: false,
    enabled: !!uidFromRoute,
  });

  const { auth } = Route.useRouteContext();
  return (
    <ChatPage
      key={key}
      auth={auth}
      task={task || null}
      isTaskLoading={isTaskLoading}
    />
  );
}
