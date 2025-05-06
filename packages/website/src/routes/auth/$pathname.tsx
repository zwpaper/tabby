import { AuthCard } from "@daveyplate/better-auth-ui";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/$pathname")({
  component: Auth,
});

function Auth() {
  const { pathname } = Route.useParams();
  return (
    <div className="flex size-full min-h-screen grow flex-col items-center justify-center gap-3">
      <AuthCard socialLayout="vertical" pathname={pathname} />
    </div>
  );
}
