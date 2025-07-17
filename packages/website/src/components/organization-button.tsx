import { authClient } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-hooks";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "./ui/button";

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
      return orgs?.[0];
    },
    enabled: !!activeOrganizationId,
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
    >
      <Button
        size="sm"
        className="h-8 max-w-[50px] overflow-hidden whitespace-nowrap font-normal md:max-w-[200px]"
        variant="ghost"
      >
        <span className="truncate">{organization?.slug ?? "Create Team"}</span>
      </Button>
    </Link>
  );
}
