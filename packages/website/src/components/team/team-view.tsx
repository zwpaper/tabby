import type { authClient } from "@/lib/auth-client";
import {
  OrganizationInvitationsCard,
  OrganizationLogo,
  OrganizationMembersCard,
  OrganizationSettingsCards,
} from "@daveyplate/better-auth-ui";
import { useQueryClient } from "@tanstack/react-query";
import { BillingCard } from "./billing-card";

interface TeamViewProps {
  organization: NonNullable<
    ReturnType<typeof authClient.useActiveOrganization>["data"]
  >;
}

export function TeamView({ organization }: TeamViewProps) {
  const queryClient = useQueryClient();

  const pendingInvitations = organization?.invitations?.filter(
    (invitation) => invitation.status === "pending",
  );

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-8 lg:px-8">
      {/* Team Header */}
      <div className="flex items-center gap-4">
        <OrganizationLogo organization={organization} className="size-12" />
        <h1 className="font-bold text-3xl tracking-tight">
          {organization.name}
        </h1>
      </div>

      {/* Members Section */}
      <div className="space-y-4">
        <div className="mx-4 space-y-1">
          <h2 className="font-semibold text-base text-foreground">Members</h2>
          <p className="text-muted-foreground text-xs">
            Manage your team members and their roles.
          </p>
        </div>
        <OrganizationMembersCard
          className="m-4 w-auto gap-6 rounded-sm border border-border/50 bg-card py-0 text-card-foreground shadow-sm"
          classNames={{
            title: "hidden",
            description: "hidden",
          }}
        />
      </div>

      {/* Invitations Section */}
      {!!pendingInvitations.length && (
        <div className="space-y-4">
          <div className="mx-4 space-y-1">
            <h2 className="font-semibold text-base text-foreground">
              Invitations
            </h2>
            <p className="text-muted-foreground text-xs">
              Manage pending invitations for new members.
            </p>
          </div>
          <OrganizationInvitationsCard
            className="m-4 w-auto gap-6 rounded-sm border border-border/50 bg-card py-0 text-card-foreground shadow-sm"
            classNames={{
              title: "hidden",
              description: "hidden",
            }}
          />
        </div>
      )}

      {/* Billing Section */}
      <div className="space-y-4">
        <div className="mx-4 space-y-1">
          <h2 className="font-semibold text-base text-foreground">Billing</h2>
          <p className="text-muted-foreground text-xs">
            Manage your team's subscription and billing details.
          </p>
        </div>
        <BillingCard
          queryClient={queryClient}
          organizationId={organization.id}
        />
      </div>

      {/* Settings Section */}
      <div className="space-y-4">
        <div className="mx-4 space-y-1">
          <h2 className="font-semibold text-base text-foreground">Settings</h2>
          <p className="text-muted-foreground text-xs">
            Manage your team's settings and details.
          </p>
        </div>
        <OrganizationSettingsCards className="m-4 w-auto gap-6 py-0" />
      </div>
    </div>
  );
}
