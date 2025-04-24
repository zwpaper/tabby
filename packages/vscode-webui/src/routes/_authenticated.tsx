import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    if (!context.auth) {
      throw redirect({
        to: "/sign-in",
      });
    }
  },
  component: Auth,
});

function Auth() {
  return <Outlet />;
}
