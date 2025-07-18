import { OrganizationButton } from "@/components/organization-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserButton } from "@/components/user-button";
import { useSession } from "@/lib/auth-hooks";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { Terminal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_base")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col [&>*]:w-full">
      <NavHeader />
      <Outlet />
    </div>
  );
}

function NavHeader() {
  const { session } = useSession();
  return (
    <span className="mb-4 flex w-full items-center justify-between px-4 pt-4 md:mb-8 md:px-6">
      <span className="flex items-center gap-3 md:gap-6">
        <Link to="/home" className="flex items-center gap-1.5">
          <Terminal className="!size-5 animate-[spin_6s_linear_infinite]" />
          <span className="font-semibold text-base">Pochi</span>
        </Link>
        <span className="flex items-center gap-2 font-normal text-muted-foreground text-sm transition-colors duration-150 md:gap-4">
          <Link
            to="/create"
            className="hidden justify-center py-1.5 hover:text-foreground md:inline-flex"
            activeProps={{
              className: "text-foreground",
            }}
          >
            Create
          </Link>
          <Link
            to="/tasks"
            search={{
              page: 1,
              pageSize: 20,
            }}
            activeOptions={{
              includeSearch: false,
            }}
            className="inline-flex justify-center py-1.5 hover:text-foreground"
            activeProps={{
              className: "text-foreground",
            }}
          >
            Tasks
          </Link>
          {session?.activeOrganizationId && (
            <Link
              to="/leaderboard"
              className="inline-flex justify-center py-1.5 hover:text-foreground"
              activeProps={{
                className: "text-foreground ",
              }}
            >
              Leaderboard
            </Link>
          )}
          {false && (
            <Link
              to="/minions"
              search={{
                page: 1,
                pageSize: 20,
              }}
              className="px-2 py-1.5 hover:text-foreground"
              activeOptions={{
                includeSearch: false,
              }}
              activeProps={{
                className: "text-foreground font-medium",
              }}
            >
              Minions
            </Link>
          )}
          <ThemeToggle />
        </span>
      </span>
      <span className="flex items-center gap-2 md:gap-4">
        <OrganizationButton />
        <UserButton size="icon" />
      </span>
    </span>
  );
}
