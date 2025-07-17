import { authClient } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-hooks";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AiOutlineTeam } from "react-icons/ai";
import { buttonVariants } from "./ui/button";

export function OrganizationButton() {
  const { data, isLoading: isSessionLoading } = useSession();
  const activeOrganizationId = data?.session.activeOrganizationId;
  const activeOrgQuery = useQuery({
    queryKey: ["activeOrganization", activeOrganizationId],
    queryFn: async () => {
      const orgs = await authClient.organization.list({
        query: {
          orgainzationId: activeOrganizationId,
        },
        fetchOptions: {
          throw: true,
        },
      });
      return orgs?.[0] ?? null;
    },
    enabled: !!activeOrganizationId,
    retry(failureCount, error) {
      if (error.message === "Unauthorized") {
        return false;
      }
      return failureCount < 3;
    },
  });
  const organization = activeOrgQuery?.data;
  const slug = organization?.slug;

  if (isSessionLoading || (activeOrganizationId && activeOrgQuery.isPending)) {
    return null;
  }

  return (
    <Link
      to={slug ? "/teams/$slug" : "/team"}
      params={organization?.slug ? { slug } : undefined}
      className={cn(
        "max-w-[50px] gap-1 overflow-hidden whitespace-nowrap font-normal md:max-w-[200px]",
        buttonVariants({
          variant: "ghost",
          size: "sm",
        }),
      )}
    >
      <AiOutlineTeam className="size-4" />
      <span className="truncate">{organization?.name ?? "Create Team"}</span>
    </Link>
  );
}
