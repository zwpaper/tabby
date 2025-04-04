"use client";

import { AuthQueryProvider } from "@daveyplate/better-auth-tanstack";
import { AuthUIProviderTanstack } from "@daveyplate/better-auth-ui/tanstack";

import { authClient } from "@/lib/auth-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient();
  const navigate = useNavigate();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthQueryProvider>
        <AuthUIProviderTanstack
          authClient={authClient}
          navigate={(to) => navigate({ to })}
          persistClient={false}
          replace={(to) => navigate({ to, replace: true })}
          onSessionChange={() =>
            navigate({ to: location.pathname, replace: true })
          }
          providers={["github"]}
          signUp={false}
          settingsUrl="/settings/account"
          avatar
        >
          {children}
        </AuthUIProviderTanstack>
      </AuthQueryProvider>
    </QueryClientProvider>
  );
}
