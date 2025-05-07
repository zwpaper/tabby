import { persister, queryClient } from "@/lib/query-client";
import { AuthQueryProvider } from "@daveyplate/better-auth-tanstack";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

export const Providers: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const isSuccess = query.state.status === "success";

            // Only persist tasks query page 1.
            const cacheTasks =
              query.queryKey[0] === "tasks" && query.queryKey[1] === 1;
            return isSuccess && (query.queryKey[0] !== "tasks" || cacheTasks);
          },
        },
      }}
    >
      <AuthQueryProvider>{children}</AuthQueryProvider>
    </PersistQueryClientProvider>
  );
};
