import { AcceptInvitationCard } from "@daveyplate/better-auth-ui";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/accept-invitation")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30">
      <AcceptInvitationCard />
    </div>
  );
}
