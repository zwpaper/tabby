import type { authClient } from "@/lib/auth-client";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

interface RouterContext {
  auth: typeof authClient.$Infer.Session;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        title: "Pochi - Your AI powered team mate",
      },
      {
        name: "description",
        content: "Chat with Pochi to generate and ship applications.",
      },
    ],
  }),

  component: () => (
    <>
      <HeadContent />
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  ),
});
