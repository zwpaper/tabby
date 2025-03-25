import { Outlet, createRootRoute, redirect } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
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
