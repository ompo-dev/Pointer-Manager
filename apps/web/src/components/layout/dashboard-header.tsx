"use client";

import { Bell, Wifi, Zap } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSessionStore } from "@/store/session-store";

export function DashboardHeader() {
  const user = useSessionStore((state) => state.user);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-background/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger />
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold sm:text-lg">
            Painel operacional do cliente
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Badge variant="secondary" className="hidden gap-2 sm:inline-flex">
          <Wifi className="size-3.5" />
          Tempo real ativo
        </Badge>
        <Badge variant="outline" className="hidden gap-2 lg:inline-flex">
          <Zap className="size-3.5" />
          {user?.role ?? "OPERACAO"}
        </Badge>
        <button
          type="button"
          className="grid size-10 place-items-center rounded-xl border border-border bg-background"
          aria-label="Notificacoes"
        >
          <Bell className="size-4" />
        </button>
        <LogoutButton />
      </div>
    </header>
  );
}
