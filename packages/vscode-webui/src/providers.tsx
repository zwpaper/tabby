import { persister, queryClient } from "@/lib/query-client";
import { AuthQueryProvider } from "@daveyplate/better-auth-tanstack";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

export const Providers: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      <AuthQueryProvider>{children}</AuthQueryProvider>
    </PersistQueryClientProvider>
  );
};
