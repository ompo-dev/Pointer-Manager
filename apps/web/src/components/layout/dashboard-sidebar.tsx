"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { ComponentType } from "react";
import {
  BarChart3,
  Building2,
  Clock3,
  FileBarChart2,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export const dashboardNavItems = [
  { href: "/dashboard", label: "Visao geral", icon: BarChart3 },
  { href: "/plants", label: "Usinas", icon: Building2 },
  { href: "/employees", label: "Pessoas", icon: Users },
  { href: "/time-entries", label: "Registros", icon: Clock3 },
  { href: "/reports", label: "Relatorios", icon: FileBarChart2 },
  { href: "/audit", label: "Auditoria", icon: ScrollText },
  { href: "/access", label: "Acessos", icon: ShieldCheck },
] as const satisfies ReadonlyArray<{
  href: Route;
  label: string;
  icon: ComponentType<{ className?: string }>;
}>;

export function DashboardSidebar() {
  const pathname = usePathname();
  const user = useSessionStore((state) => state.user);

  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      className="border-r border-border/60"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" isActive>
              <Link href="/dashboard">
                <div className="grid size-8 place-items-center rounded-lg bg-foreground text-background">
                  <ShieldCheck className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">
                    Point Manager
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Controle de acesso
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {dashboardNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.label}
                >
                  <Link href={item.href}>
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-3 text-sm">
          <p className="font-medium">{user?.name ?? "Operacao"}</p>
          <p className="text-xs text-muted-foreground">
            {user?.role ?? "ADMIN"}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
