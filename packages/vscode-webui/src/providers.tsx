import { persister, queryClient } from "@/lib/query-client";
import { AuthQueryProvider } from "@daveyplate/better-auth-tanstack";
import { makePersistedAdapter } from "@livestore/adapter-web";
import LiveStoreSharedWorker from "@livestore/adapter-web/shared-worker?sharedworker&inline";
import { LiveStoreProvider } from "@livestore/react";
import { catalog } from "@ragdoll/livekit";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { binary_to_base58 } from "base58-js";
import { useMemo } from "react";
import { unstable_batchedUpdates as batchUpdates } from "react-dom";
import { ThemeProvider } from "./components/theme-provider";
import { useCurrentWorkspace } from "./lib/hooks/use-current-workspace";
import LiveStoreWorker from "./livestore.worker.ts?worker&inline";

const adapter = makePersistedAdapter({
  storage: { type: "opfs" },
  worker: LiveStoreWorker,
  sharedWorker: LiveStoreSharedWorker,
});

export const Providers: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <ThemeProvider>
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
                query.queryKey[0] === "integrations" ||
                query.queryKey[0] === "tools" ||
                query.queryKey[0] === "mcpConnectTools";

              return isSuccess && cacheQuery;
            },
          },
        }}
      >
        <AuthQueryProvider>
          <LiveStoreProviderWrapper>{children}</LiveStoreProviderWrapper>
        </AuthQueryProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
};

function LiveStoreProviderWrapper({ children }: { children: React.ReactNode }) {
  const { data: cwd, isLoading } = useCurrentWorkspace();
  const storeId = useMemo(
    () => binary_to_base58(new TextEncoder().encode(cwd)),
    [cwd],
  );

  if (isLoading) {
    return;
  }

  return (
    <LiveStoreProvider
      schema={catalog.schema}
      adapter={adapter}
      renderLoading={(_) => <></>}
      batchUpdates={batchUpdates}
      storeId={storeId}
    >
      {children}
    </LiveStoreProvider>
  );
}
