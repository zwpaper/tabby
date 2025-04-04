import { AppSidebar } from "@/components/settings/app-sidebar";
import { SiteHeader } from "@/components/settings/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  beforeLoad: async (ctx) => {
    if (ctx.location.pathname === "/settings") {
      throw redirect({ to: "/settings/account" });
    }
  },
  loader: async () => {
    const { data } = await authClient.getSession();
    if (!data?.user) {
      throw redirect({
        to: "/auth/$pathname",
        params: { pathname: "sign-in" },
      });
    }
  },
  component: App,
});

function App() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <Outlet />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
