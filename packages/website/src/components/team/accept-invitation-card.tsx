"use client";

import { CheckIcon, Loader2, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-hooks";
import { getBetterAuthErrorMessage } from "@/lib/error";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { OrganizationView } from "./organization-view";

export interface AcceptInvitationCardProps {
  invitationId: string;
  className?: string;
}

export function AcceptInvitationCard({
  invitationId,
}: AcceptInvitationCardProps) {
  const { data: sessionData } = useSession();

  if (!sessionData || !invitationId) {
    return <AcceptInvitationSkeleton />;
  }

  return <AcceptInvitationContent invitationId={invitationId} />;
}

function AcceptInvitationContent({
  className,
  invitationId,
}: AcceptInvitationCardProps & { invitationId: string }) {
  const router = useRouter();
  const invitationQuery = useQuery({
    queryKey: ["invitation", invitationId],
    queryFn: async () => {
      return authClient.organization.getInvitation({
        query: {
          id: invitationId,
        },
      });
    },
    enabled: !!invitationId,
  });

  const [isRejecting, setIsRejecting] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const isProcessing = isRejecting || isAccepting;
  const invitation = invitationQuery.data?.data;

  useEffect(() => {
    if (invitationQuery.isLoading || !invitationId) return;

    if (!invitationQuery.data?.data) {
      toast.error("Invitation not found");

      setTimeout(() => {
        router.navigate({
          to: "/profile",
        });
      }, 2000);
    }
  }, [invitationQuery, invitationId, router]);

  const checkActiveOrganization = async (orgName: string) => {
    const member = await authClient.organization.getActiveMember({
      fetchOptions: { throw: true },
    });

    if (member) {
      throw new Error(
        `You can only be a member of one team at a time. If you want to join ${orgName} team, please leave your current team first.`,
      );
    }
  };

  const acceptInvitation = async () => {
    if (!invitation) return;

    setIsAccepting(true);

    try {
      await checkActiveOrganization(invitation.organizationName);

      const response = await authClient.organization.acceptInvitation({
        invitationId: invitationId,
        fetchOptions: { throw: true },
      });

      // update activeOrganizationId in session
      const organizationResponse = await authClient.organization.setActive({
        organizationId: response.invitation.organizationId,
        fetchOptions: { throw: true },
      });

      toast.success("Invitation accepted successfully");

      if (organizationResponse.slug) {
        return router.navigate({
          to: "/teams/$slug",
          params: {
            slug: organizationResponse.slug,
          },
        });
      }
      router.navigate({ to: "/team" });
    } catch (error) {
      toast.error(getBetterAuthErrorMessage(error), {
        duration: 10_000,
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const rejectInvitation = async () => {
    if (!invitationId) return;

    setIsRejecting(true);

    try {
      await authClient.organization.rejectInvitation({
        invitationId: invitationId,
        fetchOptions: { throw: true },
      });

      toast.success("Invitation rejected successfully");
    } catch (error) {
      toast.error(getBetterAuthErrorMessage(error));

      setIsRejecting(false);
    }
  };

  const builtInRoles = [
    { role: "owner", label: "Owner" },
    { role: "admin", label: "Admin" },
    { role: "member", label: "Member" },
  ];

  const roles = builtInRoles;
  const roleLabel =
    roles.find((r) => r.role === invitation?.role)?.label || invitation?.role;

  if (invitationQuery.isLoading) return <AcceptInvitationSkeleton />;

  return (
    <Card className={cn("w-full max-w-sm", className)}>
      <CardHeader className={cn("justify-items-center text-center")}>
        <CardTitle className={cn("text-lg md:text-xl")}>
          Accept Invitation
        </CardTitle>

        <CardDescription className={cn("text-xs md:text-sm")}>
          You have been invited to join a team.
        </CardDescription>
      </CardHeader>

      <CardContent className={cn("flex flex-col gap-6 truncate")}>
        <Card className={cn("flex-row items-center p-4")}>
          <OrganizationView
            organization={
              invitation
                ? {
                    id: invitation.organizationId,
                    name: invitation.organizationName,
                    slug: invitation.organizationSlug,
                    createdAt: new Date(),
                  }
                : null
            }
          />

          <p className="ml-auto text-muted-foreground text-sm">{roleLabel}</p>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={rejectInvitation}
            disabled={isProcessing}
          >
            {isRejecting ? <Loader2 className="animate-spin" /> : <XIcon />}
            Reject
          </Button>

          <Button onClick={acceptInvitation} disabled={isProcessing}>
            {isAccepting ? <Loader2 className="animate-spin" /> : <CheckIcon />}
            Accept
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const AcceptInvitationSkeleton = () => {
  return (
    <Card className={cn("w-full max-w-sm")}>
      <CardHeader className={cn("justify-items-center")}>
        <Skeleton className={cn("my-1 h-5 w-full max-w-32 md:h-5.5 md:w-40")} />

        <Skeleton
          className={cn("my-0.5 h-3 w-full max-w-56 md:h-3.5 md:w-64")}
        />
      </CardHeader>

      <CardContent className={cn("flex flex-col gap-6 truncate")}>
        <Card className={cn("flex-row items-center p-4")}>
          <OrganizationView isPending />

          <Skeleton className="mt-0.5 ml-auto h-4 w-full max-w-14 shrink-2" />
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-9 w-full" />

          <Skeleton className="h-9 w-full" />
        </div>
      </CardContent>
    </Card>
  );
};
