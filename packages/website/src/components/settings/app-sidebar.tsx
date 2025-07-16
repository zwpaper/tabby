import {
  IconDatabase,
  IconFileWord,
  IconHelp,
  IconReport,
  IconSearch,
  IconSettings,
} from "@tabler/icons-react";
import type * as React from "react";

import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { NavDocuments } from "./nav-documents";
import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";

const data = {
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: IconSettings,
    },
    {
      title: "Get Help",
      url: "#",
      icon: IconHelp,
    },
    {
      title: "Search",
      url: "#",
      icon: IconSearch,
    },
  ],
  documents: [
    {
      name: "Data Library",
      url: "#",
      icon: IconDatabase,
    },
    {
      name: "Reports",
      url: "#",
      icon: IconReport,
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: IconFileWord,
    },
  ],
};

export function AppSidebar({
  panes,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  panes: { title: string; url: string; icon: React.FC; active?: boolean }[];
}) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarContent>
        <NavMain items={panes} />
        {false && <NavDocuments items={data.documents} />}
        {false && (
          <NavSecondary items={data.navSecondary} className="mt-auto" />
        )}
      </SidebarContent>
    </Sidebar>
  );
}
