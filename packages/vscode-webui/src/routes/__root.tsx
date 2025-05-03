import { Toaster } from "@/components/ui/sonner";
import type { authClient } from "@/lib/auth-client";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

interface RouterContext {
  auth: typeof authClient.$Infer.Session;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Outlet />
      <Toaster />
      <TanStackRouterDevtools position="top-right" />
    </>
  ),
});
