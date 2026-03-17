"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconDotsVertical,
  IconLogout,
  IconNotification,
  IconShieldCheck,
  IconSunMoon,
  IconUserCircle,
} from "@tabler/icons-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { ActiveStateBadge, UserRoleBadge } from "@/components/status-badges";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { signOutFromApp } from "@/lib/auth/logout";
import { setAppTheme } from "@/lib/theme/set-app-theme";
import { useTheme } from "next-themes";

function buildInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    role: string;
    status: string;
    avatar: string;
  };
}) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  async function handleLogout() {
    setIsPending(true);
    await signOutFromApp();
    startTransition(() => {
      router.replace("/login");
      router.refresh();
    });
    setIsPending(false);
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {buildInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {user.email}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg md:w-[var(--radix-dropdown-menu-trigger-width)]"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">
                    {buildInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <IconUserCircle />
                Conta
              </DropdownMenuItem>
              <DropdownMenuItem className="flex-col items-start gap-2">
                <IconShieldCheck />
                <div className="flex flex-wrap gap-2">
                  <UserRoleBadge role={user.role} />
                  <ActiveStateBadge status={user.status} />
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <IconNotification />
                Notificacoes
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  setAppTheme(
                    resolvedTheme === "dark" ? "light" : "dark",
                    setTheme,
                  )
                }
              >
                <IconSunMoon />
                {resolvedTheme === "dark" ? "Tema claro" : "Tema escuro"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void handleLogout()} disabled={isPending}>
              <IconLogout />
              {isPending ? "Saindo..." : "Sair"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
