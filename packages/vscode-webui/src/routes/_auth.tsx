import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
  beforeLoad({ context, location }) {
    if (!context.auth) {
      throw redirect({
        to: "/sign-in",
        search: {
          redirect: location.pathname + location.searchStr,
        },
        replace: true,
      });
    }

    return {
      auth: context.auth,
    };
  },
  component: () => <Outlet />,
});
