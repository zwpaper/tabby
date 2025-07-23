import { apiClient, authClient } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-hooks";
import {
  OrganizationInvitationsCard,
  OrganizationMembersCard,
} from "@daveyplate/better-auth-ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { AiOutlineTeam } from "react-icons/ai";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { Skeleton } from "../ui/skeleton";
import { BillingCard } from "./billing-card";
import { DeleteTeamCard } from "./delete-team-card";
import { InfoSettingsCard } from "./info-settings-card";
import { LeaveTeamCard } from "./leave-team-card";
interface TeamViewProps {
  slug: string;
}

export function TeamView({ slug }: TeamViewProps) {
  const queryClient = useQueryClient();
  const { data: auth } = useSession();
  const { data: organization, isPending } = authClient.useActiveOrganization();
  const organizationId = organization?.id;

  const subscriptionsQuery = useQuery({
    queryKey: ["subscriptions", organizationId],
    queryFn: async () => {
      const resp = await apiClient.api.billing.subscriptions.$get({
        query: {
          organizationId,
        },
      });
      if (!resp.ok) {
        return null;
      }
      const result = await resp.json();
      return result;
    },
    enabled: !!organizationId,
  });
  const subscriptions = subscriptionsQuery.data;

  const isAdmin = useMemo(() => {
    if (!organization || !auth) return false;
    const currentMember = organization.members.find(
      (x) => x.userId === auth.user.id,
    );
    return currentMember?.role === "owner" || currentMember?.role === "admin";
  }, [organization, auth]);

  const isOwner = useMemo(() => {
    if (!organization || !auth) return false;
    const currentMember = organization.members.find(
      (x) => x.userId === auth.user.id,
    );
    return currentMember?.role === "owner";
  }, [organization, auth]);

  const pendingInvitations = organization?.invitations?.filter(
    (invitation) => invitation.status === "pending",
  );

  const hasBillingPermission =
    !subscriptionsQuery.isLoading &&
    !subscriptionsQuery.error &&
    (!!subscriptions?.length || isOwner);

  if (!isPending && (!organization || organization.slug !== slug)) {
    return (
      <div className="container mx-auto flex max-w-6xl flex-col items-center justify-center space-y-4 px-4 py-16 lg:px-8">
        <h1 className="font-bold text-3xl tracking-tight">Team Not Found</h1>
        <p className="text-muted-foreground">
          The team you are looking for does not exist or you do not have
          permission to view it.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-4 px-2 pt-6 pb-8 md:space-y-8 md:px-6 md:pt-8 lg:px-8">
      {/* Team Header */}
      <div className="flex items-center gap-4">
        <AiOutlineTeam className="size-8 md:size-12" />
        {isPending && !organization?.name ? (
          <Skeleton className="h-6 w-32" />
        ) : (
          <h1 className="font-bold text-2xl tracking-tight md:text-3xl">
            {organization?.name}
          </h1>
        )}
        <span className="rounded-full bg-stone-200 px-2.5 py-0.5 font-semibold text-sm text-stone-700 dark:bg-stone-700 dark:text-stone-200">
          Beta
        </span>
      </div>

      {/* Members Section */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-base text-foreground">Members</h2>
          <p className="text-muted-foreground text-xs">
            Manage your team members and their roles.
          </p>
        </div>
        <OrganizationMembersCard
          className="my-4 w-auto gap-6 rounded-sm border border-border/50 bg-card py-0 text-card-foreground shadow-sm"
          classNames={{
            skeleton: "mt-3",
            title: "hidden",
            description: "hidden",
            base: "gap-1",
            content: "px-2 gap-2.5",
            footer: "mt-1.5",
            cell: "px-4 py-3 rounded-md",
          }}
        />
      </div>

      {/* Invitations Section */}
      {isAdmin && !!pendingInvitations?.length && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-semibold text-base text-foreground">
              Invitations
            </h2>
            <p className="text-muted-foreground text-xs">
              Manage pending invitations for new members.
            </p>
          </div>
          <OrganizationInvitationsCard
            className="my-4 w-auto gap-6 rounded-sm border border-border/50 bg-card py-0 text-card-foreground shadow-sm"
            classNames={{
              title: "hidden",
              description: "hidden",
              base: "gap-1",
              content: "px-2 gap-2.5 pb-1.5",
              cell: "px-4 py-3 rounded-md",
            }}
          />
        </div>
      )}

      {/* Billing Section */}
      {!!organizationId && hasBillingPermission && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-semibold text-base text-foreground">Billing</h2>
            <p className="text-muted-foreground text-xs">
              Manage your team's subscription and billing details.
            </p>
          </div>
          <BillingCard
            queryClient={queryClient}
            organizationId={organizationId}
            subscriptions={subscriptions}
            isLoading={subscriptionsQuery.isLoading}
          />
        </div>
      )}

      {/* Settings Section */}
      <div className="space-y-4">
        <Accordion type="single" collapsible>
          <AccordionItem value="advanced">
            <AccordionTrigger className="flex-none pt-2 font-semibold">
              Advanced Settings
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6">
                {organization && (
                  <InfoSettingsCard
                    organization={organization}
                    disabled={!isAdmin}
                  />
                )}
                {/* Leave Team Card */}
                {!!organizationId && (
                  <LeaveTeamCard
                    organizationId={organizationId}
                    organizationSlug={slug}
                  />
                )}

                {organization && isOwner && (
                  <DeleteTeamCard organization={organization} />
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
