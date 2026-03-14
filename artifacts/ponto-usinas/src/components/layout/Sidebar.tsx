import { LayoutDashboard, Zap, Users, Clock, Activity, BarChart, Shield, FileText, Sun, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuthStore } from "@/store/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navGroups = [
  {
    label: "Visão Geral",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Usinas", url: "/usinas", icon: Zap },
      { title: "Funcionários", url: "/funcionarios", icon: Users },
    ],
  },
  {
    label: "Ponto",
    items: [
      { title: "Registros", url: "/registros", icon: Clock },
      { title: "Ativos Agora", url: "/registros/ativos", icon: Activity },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { title: "Relatórios", url: "/relatorios", icon: BarChart },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Controle de Acesso", url: "/controle-acesso", icon: Shield },
      { title: "Auditoria", url: "/auditoria", icon: FileText },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
  };

  return (
    <Sidebar className="border-r border-border bg-sidebar">
      <SidebarContent>
        <div className="p-4 flex items-center space-x-2 border-b border-border mb-4">
          <div className="bg-primary/10 p-2 rounded-md">
            <Sun className="w-5 h-5 text-primary" />
          </div>
          <span className="font-semibold text-foreground text-lg tracking-tight">SolarPonto</span>
        </div>

        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="mt-2">
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                          isActive 
                            ? "bg-accent text-accent-foreground font-medium" 
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                      >
                        <Link href={item.url} className="flex items-center gap-3 w-full">
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        <div className="flex items-center gap-3 w-full justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-8 w-8 rounded-md bg-primary/10">
              <AvatarFallback className="rounded-md text-primary font-medium text-xs">
                {user?.nome?.substring(0, 2).toUpperCase() || "US"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-foreground truncate">{user?.nome}</span>
              <span className="text-xs text-muted-foreground truncate">{user?.perfil}</span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
