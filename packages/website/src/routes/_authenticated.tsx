import { useWaitlistCheck } from "@/hooks/use-waitlist-check";
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
  },
  component: Auth,
});

function Auth() {
  // Use waitlist check hook to get latest waitlist approval status
  useWaitlistCheck();

  return <Outlet />;
}
