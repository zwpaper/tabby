"use client";

import { AuthQueryProvider } from "@daveyplate/better-auth-tanstack";
import { AuthUIProviderTanstack } from "@daveyplate/better-auth-ui/tanstack";

import { Toaster } from "@/components/ui/sonner";
import { authClient } from "@/lib/auth-client";
import type { Router } from "@/main";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./components/theme-provider";

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
          signUp={true}
          settings={{
            url: "/profile",
          }}
          social={{
            providers: ["github", "google"],
          }}
          avatar
          credentials={false}
          magicLink={true}
        >
          <ThemeProvider>{children}</ThemeProvider>
          <Toaster richColors offset={{ bottom: 16 }} />
        </AuthUIProviderTanstack>
      </AuthQueryProvider>
    </QueryClientProvider>
  );
}
