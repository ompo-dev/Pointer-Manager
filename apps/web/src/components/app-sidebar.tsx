"use client";

import * as React from "react";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { PanelContextSwitcher } from "@/components/panel-context-switcher";
import {
  getDashboardNavSections,
  getDashboardQuickLinks,
} from "@/components/layout/dashboard-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useSessionStore } from "@/store/session-store";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const user = useSessionStore((state) => state.user);
  const navSections = getDashboardNavSections(user);
  const quickLinks = getDashboardQuickLinks(user);

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <PanelContextSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={navSections}
          quickLinks={quickLinks}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.name ?? "Operacao",
            email: user?.email ?? "admin@cliente-solar.com",
            role: user?.role ?? "ADMIN",
            status: user?.status ?? "ACTIVE",
            avatar: "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
