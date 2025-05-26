import { IconTestPipe, IconUsers } from "@tabler/icons-react";
import type * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { NavMain } from "../settings/nav-main";
import { UserButton } from "../user-button";

const adminNavItems = [
  {
    title: "Users",
    url: "/admin/users",
    icon: IconUsers,
  },
  {
    title: "Prompt Evaluation",
    url: "/admin/prompt-evaluation",
    icon: IconTestPipe,
  },
];
export function AdminSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/admin">
                <ShieldAlert className="!size-5" />
                <span className="font-semibold text-base">Admin</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={adminNavItems} />
      </SidebarContent>
      <SidebarFooter>
        <UserButton size="full" />
      </SidebarFooter>
    </Sidebar>
  );
}
