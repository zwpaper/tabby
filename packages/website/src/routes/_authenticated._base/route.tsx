import { UserButton } from "@/components/user-button";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { Terminal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_base")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="mx-auto max-w-6xl">
      <NavHeader />
      <Outlet />
    </div>
  );
}

function NavHeader() {
  return (
    <span className="mb-4 flex w-full justify-between px-2 pt-4 md:mb-8 md:px-6">
      <span className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-1.5">
          <Terminal className="!size-5 animate-[spin_6s_linear_infinite]" />
          <span className="font-semibold text-base">Pochi</span>
        </Link>
      </span>
      <UserButton size="icon" />
    </span>
  );
}
