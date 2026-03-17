"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { isDashboardPathActive, withDashboardPlantContext } from "@/components/layout/dashboard-nav";
import { ChevronRightIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";

type NavItem = {
  title: string;
  url: Route;
  icon?: ComponentType<{ className?: string }>;
  items?: {
    title: string;
    url: Route;
  }[];
};

export function NavMain({
  items,
  quickLinks,
}: {
  items: NavItem[];
  quickLinks?: {
    name: string;
    url: Route;
    icon: ComponentType<{ className?: string }>;
  }[];
}) {
  const pathname = usePathname() ?? "/dashboard";
  const searchParams = useSearchParams();
  const plantId = searchParams?.get("plant");

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.items?.some((subItem) =>
              isDashboardPathActive(pathname, subItem.url),
            );

            return (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={isActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={isActive}
                      className="group-data-[collapsible=icon]:justify-center"
                    >
                      {Icon ? <Icon /> : null}
                      <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                      <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[collapsible=icon]:hidden group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items?.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isDashboardPathActive(pathname, subItem.url)}
                          >
                            <Link href={withDashboardPlantContext(subItem.url, plantId)}>
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>

      {quickLinks?.length ? (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Acesso rapido</SidebarGroupLabel>
          <SidebarMenu>
            {quickLinks.map((item) => {
              const Icon = item.icon;

              return (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={isDashboardPathActive(pathname, item.url)}
                    tooltip={item.name}
                    className="group-data-[collapsible=icon]:justify-center"
                  >
                    <Link href={withDashboardPlantContext(item.url, plantId)}>
                      <Icon />
                      <span className="group-data-[collapsible=icon]:hidden">{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ) : null}
    </>
  );
}
