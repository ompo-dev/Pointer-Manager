import { Suspense } from "react";
import { DashboardScreen } from "@/modules/dashboard/dashboard-screen";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Carregando painel...</div>}>
      <DashboardScreen />
    </Suspense>
  );
}
