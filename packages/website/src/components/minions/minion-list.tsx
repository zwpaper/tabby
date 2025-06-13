import { apiClient } from "@/lib/auth-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "../ui/button";

async function fetchMinions() {
  const res = await apiClient.api.minions.$get();
  if (!res.ok) {
    throw new Error("Failed to fetch minions");
  }
  const json = await res.json();
  return json.data;
}

export function MinionList() {
  const queryClient = useQueryClient();
  const {
    data: minions,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["minions"],
    queryFn: fetchMinions,
  });

  const { mutate: resume } = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.api.minions[":id"].resume.$post({
        param: { id: id.toString() },
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Minion resumed successfully");
      queryClient.invalidateQueries({
        queryKey: ["minions"],
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
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
            <p>
              <span className="font-semibold">URL:</span>{" "}
              <a
                href={minion.url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 hover:underline"
              >
                {minion.url}
              </a>
            </p>
            <p className="mt-2 text-gray-500 text-sm">
              Created: {new Date(minion.createdAt).toLocaleString()}
            </p>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => resume(minion.id)}>Resume</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
