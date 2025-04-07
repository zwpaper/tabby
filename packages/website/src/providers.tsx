"use client";

import { AuthQueryProvider } from "@daveyplate/better-auth-tanstack";
import { AuthUIProviderTanstack } from "@daveyplate/better-auth-ui/tanstack";

import { authClient } from "@/lib/auth-client";
import type { Router } from "@/main";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Providers({
  router,
  children,
}: { router: Router; children: React.ReactNode }) {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthQueryProvider>
        <AuthUIProviderTanstack
          authClient={authClient}
          navigate={(to) => router.navigate({ to })}
          persistClient={false}
          replace={(to) => router.navigate({ to, replace: true })}
          onSessionChange={() =>
            router.navigate({ to: location.pathname, replace: true })
          }
          providers={["github"]}
          signUp={false}
          settingsUrl="/account"
          avatar
          credentials={false}
        >
          {children}
        </AuthUIProviderTanstack>
      </AuthQueryProvider>
    </QueryClientProvider>
  );
}
