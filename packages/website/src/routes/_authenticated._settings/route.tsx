import { AppSidebar } from "@/components/settings/app-sidebar";
import { SiteHeader } from "@/components/settings/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn, tw } from "@/lib/utils";
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

  const sidebarStyle = (x: string) => tw`[&>div[data-sidebar=sidebar]]:${x}`;

  return (
    <SidebarProvider className="mx-auto max-w-6xl md:mt-8">
      <AppSidebar
        variant="floating"
        className={cn(
          "max-h-120",
          ["bg-transparent", "border-none", "shadow-none"].map(sidebarStyle),
        )}
        panes={MainPanes.filter((p) => !p.hide || user.role === "admin")}
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
