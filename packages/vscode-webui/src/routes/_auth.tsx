import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
  beforeLoad({ context }) {
    return {
      auth: context.auth,
    };
  },
  component: () => <Outlet />,
});
