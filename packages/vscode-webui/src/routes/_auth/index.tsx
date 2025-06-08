import { ChatPage } from "@/features/chat";
import { apiClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import "@/components/prompt-form/prompt-form.css";

const searchSchema = z.object({
  taskId: z
    .number()
    .or(z.enum(["new"]))
    .optional(),
  ts: z.number().optional(),
});

export const Route = createFileRoute("/_auth/")({
  validateSearch: (search) => searchSchema.parse(search),
  component: RouteComponent,
});

function RouteComponent() {
  const { taskId: taskIdFromRoute, ts = Date.now() } = Route.useSearch();
  const key =
    typeof taskIdFromRoute === "number"
      ? `task-${taskIdFromRoute}`
      : `new-${ts}`;

  const { data: task, isFetching: isTaskLoading } = useQuery({
    queryKey: ["task", taskIdFromRoute],
    queryFn: async () => {
      if (typeof taskIdFromRoute === "number") {
        const resp = await apiClient.api.tasks[":id"].$get({
          param: {
            id: taskIdFromRoute.toString(),
          },
        });
        return resp.json();
      }
      return null;
    },
    refetchOnWindowFocus: false,
    enabled: typeof taskIdFromRoute === "number",
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
