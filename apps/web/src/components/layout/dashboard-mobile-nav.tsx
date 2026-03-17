"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  getDashboardQuickLinks,
  isDashboardPathActive,
  withDashboardPlantContext,
} from "@/components/layout/dashboard-nav";
import { useSessionStore } from "@/store/session-store";

export function DashboardMobileNav() {
  const pathname = usePathname() ?? "/dashboard";
  const searchParams = useSearchParams();
  const plantId = searchParams?.get("plant");
  const user = useSessionStore((state) => state.user);
  const quickLinks = getDashboardQuickLinks(user);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur xl:hidden">
      <div className="grid grid-cols-3 gap-2">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          const active = isDashboardPathActive(pathname, item.url);

          return (
            <Link
              key={item.url}
              href={withDashboardPlantContext(item.url, plantId)}
              className={cn(
                "flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-[11px] font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-panel"
                  : "text-muted hover:bg-card hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span className="leading-tight">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
