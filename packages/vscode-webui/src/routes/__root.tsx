import type { authClient } from "@/lib/auth-client";
import {
  Outlet,
  createRootRouteWithContext,
  redirect,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

interface RouterContext {
  auth: typeof authClient.$Infer.Session;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
  loader: async (context) => {
    if (context.location.pathname === "/index.html") {
      throw redirect({
        to: "/",
      });
    }
  },
});
