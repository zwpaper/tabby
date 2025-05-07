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

            // Do not persist tasks query, as it's using offset based pagination
            return isSuccess && query.queryKey[0] !== "tasks";
          },
        },
      }}
    >
      <AuthQueryProvider>{children}</AuthQueryProvider>
    </PersistQueryClientProvider>
  );
};
