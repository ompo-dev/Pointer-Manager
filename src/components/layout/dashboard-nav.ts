import type { Route } from "next";
import type { ComponentType } from "react";
import {
  BarChart3,
  Building2,
  Clock3,
  FileBarChart2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { resolveAllowedModules, type AppModule } from "@/lib/permissions";

type NavSectionDefinition = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  items: Array<{
    title: string;
    url: Route;
    module: AppModule;
  }>;
};

const navDefinitions: NavSectionDefinition[] = [
  {
    title: "Operacao",
    icon: BarChart3,
    items: [
      { title: "Visao geral", url: "/dashboard", module: "dashboard" },
      { title: "Acessos ativos", url: "/active-access", module: "time-entries" },
      { title: "Registros", url: "/time-entries", module: "time-entries" },
      { title: "Auditoria", url: "/audit", module: "audit" },
    ],
  },
  {
    title: "Cadastros",
    icon: Building2,
    items: [
      { title: "Usinas", url: "/plants", module: "plants" },
      { title: "Pessoas", url: "/people", module: "people" },
      { title: "Controle de acesso", url: "/access", module: "access" },
    ],
  },
  {
    title: "Analise",
    icon: FileBarChart2,
    items: [{ title: "Relatorios", url: "/reports", module: "reports" }],
  },
];

const quickLinkDefinitions = [
  {
    name: "Acessos ativos",
    url: "/active-access" as Route,
    icon: Clock3,
    module: "time-entries" as AppModule,
  },
  {
    name: "Gerenciar usinas",
    url: "/plants" as Route,
    icon: ShieldCheck,
    module: "plants" as AppModule,
  },
  {
    name: "Pessoas e perfis",
    url: "/people" as Route,
    icon: Users,
    module: "people" as AppModule,
  },
];

export function getDashboardNavSections(user?: { role?: string | null; modulePermissions?: string[] | null } | null) {
  const allowedModules = new Set(resolveAllowedModules(user));

  return navDefinitions
    .map((section) => {
      const items = section.items.filter((item) => allowedModules.has(item.module));

      if (items.length === 0) {
        return null;
      }

      return {
        title: section.title,
        url: items[0].url,
        icon: section.icon,
        items: items.map(({ title, url }) => ({ title, url })),
      };
    })
    .filter((section): section is NonNullable<typeof section> => section !== null);
}

export function getDashboardQuickLinks(user?: { role?: string | null; modulePermissions?: string[] | null } | null) {
  const allowedModules = new Set(resolveAllowedModules(user));

  return quickLinkDefinitions.filter((item) => allowedModules.has(item.module));
}

export const dashboardRouteLabels: Record<string, string> = {
  "/dashboard": "Visao geral",
  "/active-access": "Acessos ativos",
  "/plants": "Usinas",
  "/people": "Pessoas",
  "/time-entries": "Registros",
  "/reports": "Relatorios",
  "/audit": "Auditoria",
  "/access": "Controle de acesso",
};

export function isDashboardPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function resolveDashboardRouteLabel(pathname: string) {
  return (
    Object.entries(dashboardRouteLabels).find(([href]) =>
      isDashboardPathActive(pathname, href),
    )?.[1] ?? "Painel"
  );
}

export function withDashboardPlantContext(pathname: Route, plantId?: string | null) {
  if (!plantId) {
    return pathname;
  }

  return `${pathname}?plant=${encodeURIComponent(plantId)}` as Route;
}
