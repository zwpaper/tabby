import { AcceptInvitationCard } from "@/components/organization/accept-invitation-card";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// FIXME show invalid URL page
const searchSchema = z.object({
  invitationId: z.string(),
});

export const Route = createFileRoute("/_authenticated/accept-invitation")({
  validateSearch: (search) => searchSchema.parse(search),
  component: RouteComponent,
});

function RouteComponent() {
  const { invitationId } = Route.useSearch();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30">
      <AcceptInvitationCard invitationId={invitationId} />
    </div>
  );
}
