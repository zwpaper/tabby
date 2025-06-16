import { apiClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { buttonVariants } from "../ui/button";

async function fetchMinions() {
  const res = await apiClient.api.minions.$get();
  if (!res.ok) {
    throw new Error("Failed to fetch minions");
  }
  const json = await res.json();
  return json.data;
}

export function MinionList() {
  const {
    data: minions,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["minions"],
    queryFn: fetchMinions,
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-4 font-bold text-2xl">Minion List</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {minions?.map((minion) => (
          <div key={minion.id} className="rounded-lg border p-4 shadow-sm">
            <Link to={"/minions/$id"} params={{ id: minion.id.toString() }}>
              <h2 className="mb-2 font-semibold text-xl">
                Minion #{minion.id}
              </h2>
            </Link>
            <p>
              <span className="font-semibold">Sandbox ID:</span>{" "}
              {minion.e2bSandboxId}
            </p>
            <p className="mt-2 text-gray-500 text-sm">
              Created: {new Date(minion.createdAt).toLocaleString()}
            </p>
            <a
              href={`/api/minions/${minion.id}/redirect`}
              className={buttonVariants({
                variant: "outline",
              })}
            >
              Open
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
