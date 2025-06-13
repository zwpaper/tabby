import { apiClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

async function fetchMinion(id: string) {
  const res = await apiClient.api.minions[":id"].$get({
    param: { id },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch minion");
  }
  const json = await res.json();
  return json.data;
}

export const Route = createFileRoute("/_authenticated/minions/$id")({
  component: MinionPage,
});

function MinionPage() {
  const { id } = Route.useParams();
  const {
    data: minion,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["minions", id],
    queryFn: () => fetchMinion(id),
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!minion) {
    return <div>Minion not found</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-4 font-bold text-2xl">
        Minion #{minion.id} - {minion.sandbox ? "Running" : "Paused"}
      </h1>
      <p>
        <a
          className="underline"
          href={minion.url}
          target="_blank"
          rel="noreferrer"
        >
          Open VSCode
        </a>
      </p>
      <div className="space-y-4">
        <div>
          <h2 className="mb-2 font-semibold text-xl">init.log</h2>
          <pre className="rounded-lg border bg-gray-100 p-4">
            {minion.sandbox?.initLog}
          </pre>
        </div>
        <div>
          <h2 className="mb-2 font-semibold text-xl">runner.log</h2>
          <pre className="rounded-lg border bg-gray-100 p-4">
            {minion.sandbox?.runnerLog}
          </pre>
        </div>
      </div>
    </div>
  );
}
