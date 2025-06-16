import { UserButton } from "@/components/user-button";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { Terminal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_base")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="mx-auto max-w-5xl">
      <NavHeader />
      <Outlet />
    </div>
  );
}

function NavHeader() {
  return (
    <span className="mb-4 flex w-full justify-between px-2 pt-4 md:mb-8 md:px-6">
      <span className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-1.5">
          <Terminal className="!size-5 animate-[spin_6s_linear_infinite]" />
          <span className="font-semibold text-base">Pochi</span>
        </Link>
        <span className="flex items-center gap-4 font-normal text-muted-foreground text-sm transition-colors duration-150">
          <Link
            to="/tasks"
            search={{
              page: 1,
              limit: 20,
            }}
            className="px-2 py-1.5 hover:text-foreground"
            activeOptions={{
              includeSearch: false,
            }}
            activeProps={{
              className: "text-foreground font-medium",
            }}
          >
            Tasks
          </Link>
          {false && (
            <Link
              to="/minions"
              search={{
                page: 1,
                limit: 20,
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
        </span>
      </span>
      <UserButton size="icon" />
    </span>
  );
}
