import { AdminSidebar } from "@/components/admin/admin-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context, location }) => {
    // Check if user has admin privileges
    if (context.auth.user.role !== "admin") {
      throw redirect({
        to: "/",
      });
    }

    if (location.pathname === "/admin") {
      throw redirect({ to: "/admin/users" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <div className="h-5 w-px bg-border" />
            <h1 className="font-semibold">Admin Panel</h1>
          </div>
        </header>
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
