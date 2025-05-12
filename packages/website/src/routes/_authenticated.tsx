import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context, location }) => {
    if (!context.auth) {
      throw redirect({
        to: "/auth/$pathname",
        params: { pathname: "sign-in" },
        search: {
          redirectTo: location.href,
        },
      });
    }
    if (
      !context.auth.user.isWaitlistApproved &&
      !context.auth.user.email.endsWith("@tabbyml.com")
    ) {
      throw redirect({
        to: "/waitlist",
      });
    }
  },
  component: Auth,
});

function Auth() {
  return <Outlet />;
}
