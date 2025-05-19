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

            const cacheQuery =
              query.queryKey[0] === "session" ||
              // Only persist tasks query page 1.
              (query.queryKey[0] === "tasks" && query.queryKey[1] === 1) ||
              query.queryKey[0] === "integrations";

            return isSuccess && cacheQuery;
          },
        },
      }}
    >
      <AuthQueryProvider>{children}</AuthQueryProvider>
    </PersistQueryClientProvider>
  );
};
