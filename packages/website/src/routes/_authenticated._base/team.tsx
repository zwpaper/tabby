import { CreateTeamForm } from "@/components/team/create-team-form";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_base/team")({
  component: TeamComponent,
  loader: async ({ context }) => {
    if (context.auth.session.activeOrganizationId) {
      const orgs = await authClient.organization.list({
        query: {
          orgainzationId: context.auth.session.activeOrganizationId,
        },
      });
      const organizationSlug = orgs.data?.[0]?.slug;
      if (organizationSlug) {
        throw redirect({
          to: "/teams/$slug",
          params: {
            slug: organizationSlug,
          },
        });
      }
    }
  },
  pendingComponent: PendingComponent,
});

function TeamComponent() {
  const router = useRouter();
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 lg:px-8">
      {/* Main heading */}
      <h1 className="mb-16 font-bold text-5xl">Team</h1>

      <div className="mb-20 grid grid-cols-1 gap-12 lg:grid-cols-2">
        {/* Left column - Team features */}
        <div className="space-y-12">
          <div>
            <h2 className="mb-4 font-semibold text-2xl">
              Shared billing & credits
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Pooled billing of usage makes it easier to manage costs across
              your team.
            </p>
          </div>
        </div>

        {/* Right column - Join team */}
        <div>
          <h2 className="mb-4 font-semibold text-2xl">Join a Team</h2>
          <p className="mb-6 text-muted-foreground leading-relaxed">
            Ask a team admin to send you an invitation from their team page.
            You'll receive an email with a link to join.
          </p>
          {/* <p className="text-muted-foreground leading-relaxed">
            If your team uses SSO, sign in with the correct email (usually your
            work email).
          </p> */}
        </div>
      </div>

      {/* Create team section */}
      <div className="max-w-xl">
        <h2 className="mb-6 font-semibold text-2xl">Create a Team</h2>
        <CreateTeamForm onCreated={() => router.invalidate()} />
      </div>
    </div>
  );
}

function PendingComponent() {
  return (
    <div className="flex min-h-screen w-screen items-center justify-center">
      <Loader2 className="animate-spin" />
    </div>
  );
}
