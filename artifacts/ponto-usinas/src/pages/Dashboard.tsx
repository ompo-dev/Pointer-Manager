import { useEffect, useRef } from "react";
import { useGetDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, LogOut, Zap, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import gsap from "gsap";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function Counter({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!nodeRef.current) return;
    
    const obj = { val: 0 };
    gsap.to(obj, {
      val: value,
      duration: 1.5,
      ease: "power2.out",
      onUpdate: () => {
        if (nodeRef.current) {
          nodeRef.current.textContent = `${prefix}${Math.floor(obj.val)}${suffix}`;
        }
      },
    });
  }, [value, prefix, suffix]);

  return <span ref={nodeRef}>0</span>;
}

export default function Dashboard() {
  const { data, isLoading } = useGetDashboard({
    query: {
      refetchInterval: 30000, // Refresh every 30s
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Skeleton className="col-span-4 h-96" />
          <Skeleton className="col-span-3 h-96" />
        </div>
      </div>
    );
  }

  const dashData = data!;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-muted-foreground">Visão geral do sistema de ponto das usinas.</p>
      </div>

      {dashData.alertas?.length > 0 && (
        <div className="space-y-3">
          {dashData.alertas.map((alerta, idx) => (
            <div key={idx} className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="text-sm font-medium">{alerta.mensagem}</p>
                <p className="text-xs opacity-80">{alerta.funcionarioNome} - {alerta.usinaNome}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos Agora</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Counter value={dashData.funcionariosAtivos} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Funcionários nas usinas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Registros Hoje</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Counter value={dashData.registrosHoje} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Entradas e saídas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sem Saída</CardTitle>
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              <Counter value={dashData.semSaida} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Registros abertos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Usinas</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Counter value={dashData.totalUsinas} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Usinas ativas no sistema</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Status das Usinas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {dashData.usinaStats.map((usina) => (
                <div key={usina.usinaId} className="flex items-center">
                  <div className="w-[150px] shrink-0 truncate font-medium text-sm">
                    {usina.usinaNome}
                  </div>
                  <div className="flex-1 ml-4 flex items-center gap-2">
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${Math.min(100, (usina.funcionariosAtivos / Math.max(1, dashData.funcionariosAtivos)) * 100)}%` }} 
                      />
                    </div>
                    <span className="text-sm text-muted-foreground font-medium w-8 text-right">
                      {usina.funcionariosAtivos}
                    </span>
                  </div>
                </div>
              ))}
              {dashData.usinaStats.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum dado disponível.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Entradas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 overflow-auto max-h-[300px]">
              {dashData.recenteRegistros?.map((registro) => (
                <div key={registro.registroId} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-medium text-primary">
                      {registro.funcionarioNome.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{registro.funcionarioNome}</p>
                    <p className="text-xs text-muted-foreground truncate">{registro.usinaNome}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-medium">{new Date(registro.dataHoraEntrada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <Badge variant="outline" className="mt-1 text-[10px] h-4">
                      {registro.minutosNoLocal}m
                    </Badge>
                  </div>
                </div>
              ))}
              {(!dashData.recenteRegistros || dashData.recenteRegistros.length === 0) && (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum registro recente.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
