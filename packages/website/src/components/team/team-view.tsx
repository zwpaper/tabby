import { authClient } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-hooks";
import {
  OrganizationInvitationsCard,
  OrganizationLogo,
  OrganizationMembersCard,
  OrganizationSettingsCards,
} from "@daveyplate/better-auth-ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Skeleton } from "../ui/skeleton";
import { BillingCard } from "./billing-card";

interface TeamViewProps {
  slug: string;
}

export function TeamView({ slug }: TeamViewProps) {
  const queryClient = useQueryClient();
  const { data: auth } = useSession();
  const { data: organization, isPending } = authClient.useActiveOrganization();
  const organizationId = organization?.id;

  const subscriptionQuery = useQuery({
    queryKey: ["subscription", organizationId],
    queryFn: async () => {
      const subscription = await authClient.subscription.list({
        query: {
          referenceId: organizationId,
        },
        fetchOptions: {
          throw: true,
        },
      });

      return subscription;
    },
    enabled: !!organizationId,
    retry(failureCount, error) {
      if (error.message === "Unauthorized") return false;
      return failureCount < 2;
    },
  });

  const subscription = useMemo(() => {
    return subscriptionQuery.data?.find(
      (x) => x.referenceId === organizationId,
    );
  }, [subscriptionQuery.data, organizationId]);

  const isAdmin = useMemo(() => {
    if (!organization || !auth) return false;
    const currentMember = organization.members.find(
      (x) => x.userId === auth.user.id,
    );
    return currentMember?.role === "owner" || currentMember?.role === "admin";
  }, [organization, auth]);

  const pendingInvitations = organization?.invitations?.filter(
    (invitation) => invitation.status === "pending",
  );

  const hasBillingPermission =
    !subscriptionQuery.isPending && !subscriptionQuery.error;

  useEffect(() => {
    if (!!organization && organization.slug !== slug) {
      throw notFound();
    }
  }, [slug, organization]);

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-8 lg:px-8">
      {/* Team Header */}
      <div className="flex items-center gap-4">
        <OrganizationLogo organization={organization} className="size-12" />
        {isPending && !organization?.name ? (
          <Skeleton className="h-6 w-32" />
        ) : (
          <h1 className="font-bold text-3xl tracking-tight">
            {organization?.name}
          </h1>
        )}
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
            skeleton: "mt-3",
            title: "hidden",
            description: "hidden",
          }}
        />
      </div>

      {/* Invitations Section */}
      {isAdmin && !!pendingInvitations?.length && (
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
      {!!organizationId && hasBillingPermission && (
        <div className="space-y-4">
          <div className="mx-4 space-y-1">
            <h2 className="font-semibold text-base text-foreground">Billing</h2>
            <p className="text-muted-foreground text-xs">
              Manage your team's subscription and billing details.
            </p>
          </div>
          <BillingCard
            queryClient={queryClient}
            organizationId={organizationId}
            subscription={subscription}
          />
        </div>
      )}

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
