import { apiClient, authClient } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-hooks";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import { AiOutlineTeam } from "react-icons/ai";
import { buttonVariants } from "./ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";

// Infer type from API response
const pendingInvitationsQuery = apiClient.api.invitation.me.$get;
type PendingInvitationsResponse = InferResponseType<
  typeof pendingInvitationsQuery
>;
type Invitation = PendingInvitationsResponse["invitations"];

function InvitationList({
  invitations,
  isLoading,
}: { isLoading: boolean; invitations: Invitation }) {
  if (isLoading) {
    return <div className="p-4 text-muted-foreground text-sm">Loading...</div>;
  }

  if (!invitations?.length) {
    return (
      <div className="p-4 text-muted-foreground text-sm">
        No pending invitations.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-1">
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="flex items-center justify-between gap-2 rounded p-1.5 hover:bg-muted/50"
        >
          <div className="text-xs">
            <span className="font-semibold">{invitation.organizationName}</span>
            <span className="text-muted-foreground"> invites you to join.</span>
          </div>
          <div className="flex gap-1">
            <Link
              to="/accept-invitation"
              search={{ invitationId: invitation.id }}
              className={cn(
                buttonVariants({ size: "sm" }),
                "h-auto px-2 py-1 text-xs",
              )}
            >
              View
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OrganizationButton() {
  const { data, isLoading: isSessionLoading } = useSession();
  const activeOrganizationId = data?.session.activeOrganizationId;
  const { data: invitations, isLoading } = useQuery({
    queryKey: ["pendingInvitations"],
    queryFn: async () => {
      const resp = await apiClient.api.invitation.me.$get({
        query: {
          status: "pending",
        },
      });
      if (!resp.ok) {
        throw new Error("Failed to fetch invitations");
      }
      const data = await resp.json();
      return data.invitations;
    },
  });

  const activeOrgQuery = useQuery({
    queryKey: ["activeOrganization", activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return null;
      const orgs = await authClient.organization.list({
        query: {
          orgainzationId: activeOrganizationId,
        },
      });
      if (orgs.data && orgs.data.length > 0) {
        return orgs.data[0];
      }
      return null;
    },
    enabled: !!activeOrganizationId,
  });
  const organization = activeOrgQuery?.data;
  const slug = organization?.slug;

  if (isSessionLoading || (activeOrganizationId && activeOrgQuery.isPending)) {
    return null;
  }

  const hasPendingInvitations = invitations && invitations.length > 0;

  const button = (
    <Link
      to={slug ? "/teams/$slug" : "/team"}
      params={slug ? { slug } : undefined}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "relative flex max-w-[50px] items-center gap-1 whitespace-nowrap font-normal md:max-w-[200px]",
      )}
    >
      <AiOutlineTeam className="size-4 shrink-0" />
      <span className="truncate md:inline">
        {organization?.name ?? "Create Team"}
      </span>
      {hasPendingInvitations && (
        <span className="-translate-y-1/2 absolute top-1 right-1 z-10 flex size-3.5 translate-x-1/2 transform items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-xs text-xs">
          {invitations.length}
        </span>
      )}
    </Link>
  );

  if (!hasPendingInvitations) {
    return button;
  }

  return (
    <HoverCard openDelay={0}>
      <HoverCardTrigger asChild>{button}</HoverCardTrigger>
      <HoverCardContent className="w-auto p-0" align="end">
        <InvitationList isLoading={isLoading} invitations={invitations} />
      </HoverCardContent>
    </HoverCard>
  );
}
