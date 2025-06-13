import { AppSidebar } from "@/components/settings/app-sidebar";
import { SiteHeader } from "@/components/settings/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
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

export const Route = createFileRoute("/_authenticated/_base/_settings")({
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
  },
  {
    title: "Model",
    url: "/model",
    icon: BrainCircuit,
    hide: true,
  },
];

function Settings() {
  const {
    location: { pathname },
  } = useRouterState();

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
    <SidebarProvider className="md:min-h-[80vh]">
      <AppSidebar
        variant="floating"
        className={cn(
          "max-h-90",
          "[&>div[data-sidebar=sidebar]]:bg-transparent",
          "[&>div[data-sidebar=sidebar]]:border-none",
          "[&>div[data-sidebar=sidebar]]:shadow-none",
        )}
        panes={MainPanes.filter((p) => !p.hide)}
      />
      <SidebarInset className="md:px-4">
        <SiteHeader title={activePane?.title} />
        <div className="@container/main px-2 py-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
