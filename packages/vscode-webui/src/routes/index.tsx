import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  const { auth } = Route.useRouteContext();
  const page = 1;
  const limit = 20;
  const { data, isLoading } = useQuery({
    queryKey: ["tasks", page, limit],
    queryFn: () =>
      apiClient.api.tasks
        .$get({ query: { page: page.toString(), limit: limit.toString() } })
        .then((x) => x.json()),
  });

  const tasks = data?.data || [];

  return (
    <div className="p-2">
      <div className="mb-2">Welcome, {auth.user.name}!</div>
      <Link to="/chat">
        <Button className="w-full mt-2 mb-4 text-base">
          <PlusIcon />
          New Task
        </Button>
      </Link>

      <div className="mt-2">
        <div className="space-y-4">
          {isLoading ? (
            <>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-card p-2 rounded-xs animate-pulse">
                  <div className="h-4 bg-card/70 rounded w-1/4 mb-2" />
                  <div className="h-4 bg-card/70 rounded w-3/4" />
                </div>
              ))}
            </>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="bg-card p-2 rounded-xs hover:bg-card/70"
              >
                <Link
                  to={"/chat"}
                  search={{ taskId: task.id }}
                  className="font-bold mb-1"
                >
                  {formatTaskId(task.id)}
                </Link>
                <div>
                  <p>{task.title}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatTaskId(id: number) {
  return `TASK-${Number(id).toString().padStart(3, "0")}`;
}
