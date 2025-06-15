import { AuthCard } from "@daveyplate/better-auth-ui";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/$pathname")({
  component: Auth,
});

function Auth() {
  const { pathname } = Route.useParams();
  switch (pathname) {
    case "sign-up":
      return (
        <div className="flex size-full min-h-screen grow flex-col items-center justify-center gap-3">
          <AuthCard
            view="SIGN_UP"
            localization={{
              SIGN_UP: "Register for waitlist 👋",
              SIGN_UP_DESCRIPTION: "Fill in your details to join our waitlist",
              EMAIL: "Email",
            }}
          />
        </div>
      );
    default:
      return (
        <div className="flex size-full min-h-screen grow flex-col items-center justify-center gap-3">
          <AuthCard socialLayout="vertical" pathname={pathname} />
        </div>
      );
  }
}
