import { authClient } from "@/lib/auth-client";
import { OrganizationView } from "@daveyplate/better-auth-ui";
import { Link } from "@tanstack/react-router";

export function OrganizationButton() {
  const { data: organization, isPending } = authClient.useActiveOrganization();
  const slug = organization?.slug;

  return (
    <Link
      to={slug ? "/teams/$slug" : "/team"}
      params={organization?.slug ? { slug } : undefined}
    >
      <OrganizationView
        isPending={isPending}
        organization={organization}
        localization={{
          ORGANIZATION: "Create Team",
        }}
        className="max-w-[200px] overflow-hidden"
        classNames={{
          avatar: {
            base: "hidden",
          },
          title: "font-medium truncate",
          subtitle: "hidden",
        }}
      />
    </Link>
  );
}
