import { AppSidebar } from "@/components/settings/app-sidebar";
import { SiteHeader } from "@/components/settings/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  IconBlocks,
  IconChartBar,
  IconCreditCard,
  IconUserCircle,
} from "@tabler/icons-react";
import {
  Outlet,
  createFileRoute,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { BrainCircuit } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_settings")({
  beforeLoad: async (ctx) => {
    if (ctx.location.pathname === "/settings") {
      throw redirect({ to: "/account" });
    }
  },
  component: Settings,
});

interface Pane {
  title: string;
  url: string;
  icon: React.FC;
  hide?: boolean;
  active?: boolean;
}

const MainPanes: Pane[] = [
  {
    title: "Account",
    url: "/account",
    icon: IconUserCircle,
  },
  {
    title: "Usage",
    url: "/usage",
    icon: IconChartBar,
  },
  {
    title: "Billing",
    url: "/billing",
    icon: IconCreditCard,
    hide: true,
  },
  {
    title: "Integrations",
    url: "/integrations",
    icon: IconBlocks,
    hide: true,
  },
  {
    title: "Model",
    url: "/model",
    icon: BrainCircuit,
  },
];

function Settings() {
  const {
    location: { pathname },
  } = useRouterState();
  const {
    auth: { user },
  } = Route.useRouteContext();

  let activePane: Pane | undefined;
  for (const item of MainPanes) {
    if (item.url === pathname) {
      item.active = true;
      activePane = item;
    } else {
      item.active = false;
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar
        variant="inset"
        panes={MainPanes.filter((p) => !p.hide || user.role === "admin")}
      />
      <SidebarInset>
        <SiteHeader title={activePane?.title} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 p-2 md:gap-6 md:p-6">
              <Outlet />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
