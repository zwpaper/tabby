import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/auth-client";
import { createFileRoute, useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/tasks/$id")({
  loader: async ({ params }) => {
    const resp = await apiClient.api.tasks[":id"].$get({
      param: {
        id: params.id.toString(),
      },
    });
    return resp.json();
  },
  component: RouteComponent,
});

function RouteComponent() {
  const data = Route.useLoaderData();
  const router = useRouter();
  return (
    <div className="flex flex-col">
      <Button onClick={() => router.history.back()}>back</Button>
      <pre className="text-wrap">{JSON.stringify(data)}</pre>
    </div>
  );
}
