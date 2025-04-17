import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context, location }) => {
    // Check if user has admin privileges
    if (context.auth?.user.role !== "admin") {
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
      <AdminSidebar className="hidden md:flex h-screen" />
      <SidebarInset>
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
