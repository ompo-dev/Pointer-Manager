import { auth } from "@point-manager/auth/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SessionHydrator } from "@/components/auth/session-hydrator";
import { DashboardDataWarmup } from "@/components/layout/dashboard-data-warmup";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { toSessionUser } from "@/lib/auth/session-user";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: new Headers(await headers()),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <SidebarProvider>
      <SessionHydrator user={toSessionUser(session.user)} />
      <DashboardDataWarmup />
      <DashboardSidebar />
      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
