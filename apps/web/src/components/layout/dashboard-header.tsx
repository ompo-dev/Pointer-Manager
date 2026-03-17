"use client";

import { usePathname } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { Bell } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { resolveDashboardRouteLabel } from "@/components/layout/dashboard-nav";
import { ActiveStateBadge, RealtimeBadge, UserRoleBadge } from "@/components/status-badges";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePanelContextStore } from "@/store/panel-context-store";
import { useSessionStore } from "@/store/session-store";

export function DashboardHeader() {
  const pathname = usePathname() ?? "/dashboard";
  const [plant] = useQueryState("plant", parseAsString.withDefault(""));
  const user = useSessionStore((state) => state.user);
  const plants = usePanelContextStore((state) => state.plants);
  const currentLabel = resolveDashboardRouteLabel(pathname);
  const currentPlant = plants.find((item) => item.id === plant) ?? null;

  return (
    <header className="rounded-t-xl sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-border/60 bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="hidden h-4 self-auto sm:block"
        />
        <div className="min-w-0 space-y-1">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <p className="truncate text-sm text-muted-foreground">
            {currentPlant
              ? `${currentPlant.name} | ${currentPlant.city} - ${currentPlant.state}`
              : "Painel operacional do cliente"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-2 md:flex">
          <RealtimeBadge />
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <UserRoleBadge role={user?.role} />
          <ActiveStateBadge status={user?.status} />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-xl"
          aria-label="Notificacoes"
        >
          <Bell className="size-4" />
        </Button>
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
