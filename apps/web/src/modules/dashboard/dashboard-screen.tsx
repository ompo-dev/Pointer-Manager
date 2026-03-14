"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { parseAsString, useQueryState } from "nuqs";
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis } from "recharts";
import {
  Activity,
  AlertTriangle,
  Building2,
  DoorOpen,
  Network,
  TimerReset,
  UsersRound,
} from "lucide-react";
import { useLiveOperationsFeed } from "@/lib/realtime/use-live-operations-feed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMinutes } from "@/lib/utils";
import { useDashboardStore } from "@/store/dashboard-store";

function AnimatedMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const nodeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    const context = { current: 0 };

    if (!node) {
      return;
    }

    const tween = gsap.to(context, {
      current: value,
      duration: 1,
      ease: "power2.out",
      onUpdate: () => {
        node.textContent = Math.round(context.current).toString();
      },
    });

    return () => {
      tween.kill();
    };
  }, [value]);

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardDescription>{label}</CardDescription>
        <Icon className="size-4 text-muted" />
      </CardHeader>
      <CardContent className="space-y-3">
        <p ref={nodeRef} className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl">
          0
        </p>
        <div className="h-1 rounded-full bg-black/5">
          <div
            className="h-1 rounded-full bg-ink transition-all"
            style={{ width: `${Math.min(100, value * 6)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardScreen() {
  const [plant, setPlant] = useQueryState("plant", parseAsString.withDefault("all"));
  const overview = useDashboardStore((state) => state.overview);
  const plants = useDashboardStore((state) => state.plants);
  const error = useDashboardStore((state) => state.error);
  const loadingOverview = useDashboardStore((state) => state.loadingOverview);
  const loadOverview = useDashboardStore((state) => state.loadOverview);
  const { events, status } = useLiveOperationsFeed(plant);
  const timeline = useMemo(() => events.slice(0, 6), [events]);
  const hoursByPlantChart = useMemo(
    () =>
      (overview?.hoursByPlantToday ?? []).map((item) => ({
        name: item.plantName.length > 12 ? `${item.plantName.slice(0, 12)}...` : item.plantName,
        minutes: item.totalMinutes,
        records: item.records,
      })),
    [overview?.hoursByPlantToday],
  );

  const chartConfig = {
    minutes: {
      label: "Minutos",
      color: "hsl(var(--accent))",
    },
  } satisfies ChartConfig;

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadOverview(plant);
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadOverview, plant]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Card className="overflow-hidden">
          <CardContent className="grid-paper relative min-h-[280px] p-5 sm:p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/70 to-transparent" />
            <div className="relative flex h-full flex-col justify-between gap-6">
              <div className="space-y-5">
                <div className="space-y-3">
                  <Badge className="border-sky-200 bg-sky-50 text-sky-700">
                    Controle de acesso com realtime server-authoritative
                  </Badge>
                  <div className="space-y-2">
                    <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
                      Painel operacional para acesso fisico, auditoria e presenca nas usinas.
                    </h1>
                    <p className="max-w-2xl text-sm leading-7 text-muted">
                      O dashboard acompanha pessoas ativas, ranking de presenca,
                      horas por usina e excecoes com fechamento automatico.
                    </p>
                  </div>
                </div>

                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  <Button
                    className="shrink-0"
                    variant={plant === "all" ? "primary" : "secondary"}
                    onClick={() => void setPlant("all")}
                  >
                    Todas as usinas
                  </Button>
                  {plants.slice(0, 6).map((item) => (
                    <Button
                      key={item.id}
                      className="shrink-0"
                      variant={plant === item.id ? "primary" : "secondary"}
                      onClick={() => void setPlant(item.id)}
                    >
                      {item.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 text-sm text-muted sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <span className="inline-flex items-center gap-2">
                  <Network className="size-4" />
                  socket: {status}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Activity className="size-4" />
                  feed: {timeline.length} eventos recentes
                </span>
                {loadingOverview ? <span>atualizando painel...</span> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feed operacional</CardTitle>
            <CardDescription>Eventos emitidos em tempo real pelo hub.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted">Nenhum evento novo chegou ainda.</p>
            ) : (
              timeline.map((event) => (
                <div key={`${event.type}-${event.createdAt}`} className="rounded-2xl border border-line bg-white/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold">{event.type}</p>
                    <span className="font-mono text-xs text-muted">
                      {new Date(event.createdAt).toLocaleTimeString("pt-BR")}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-sm text-muted">{JSON.stringify(event.payload)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {error ? (
        <p className="rounded-2xl border border-line bg-black/5 px-4 py-3 text-sm">{error}</p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <AnimatedMetric
          label="Pessoas ativas"
          value={overview?.activeEmployees ?? 0}
          icon={UsersRound}
        />
        <AnimatedMetric
          label="Acessos em aberto"
          value={overview?.openEntries ?? 0}
          icon={TimerReset}
        />
        <AnimatedMetric
          label="Registros do dia"
          value={overview?.recordsToday ?? 0}
          icon={Activity}
        />
        <AnimatedMetric
          label="Sem saida"
          value={overview?.employeesWithoutExit ?? 0}
          icon={DoorOpen}
        />
        <AnimatedMetric
          label="Usinas online"
          value={overview?.plantsOnline ?? 0}
          icon={Building2}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Registros ao vivo</CardTitle>
            <CardDescription>
              Quem esta na usina agora e ha quanto tempo o acesso esta aberto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(overview?.liveEntries ?? []).map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-white/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{entry.employeeName}</p>
                  <p className="text-sm text-muted">
                    {entry.personType} | {entry.plantName}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-mono text-sm">
                    {new Date(entry.openedAt).toLocaleTimeString("pt-BR")}
                  </p>
                  <Badge className="mt-2">{entry.status}</Badge>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas de excecao</CardTitle>
            <CardDescription>
              Pessoas sem saida registrada e tempos acima da politica da usina.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(overview?.overtimeAlerts ?? []).map((alert) => (
              <div
                key={alert.id}
                className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-900"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-4" />
                  <div>
                    <p className="font-semibold">{alert.employeeName}</p>
                    <p className="text-sm">
                      {alert.plantName} | {alert.minutesOpen} minutos em aberto
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {!overview?.overtimeAlerts?.length ? (
              <p className="text-sm text-muted">Nenhum alerta critico no momento.</p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Horas por usina no dia</CardTitle>
            <CardDescription>Total de minutos por usina no periodo atual.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
              <RechartsBarChart accessibilityLayer data={hoursByPlantChart}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent formatter={(value) => formatMinutes(Number(value))} />}
                />
                <Bar dataKey="minutes" fill="var(--color-minutes)" radius={10} />
              </RechartsBarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking de presenca</CardTitle>
            <CardDescription>Ordenacao por quantidade de registros e horas acumuladas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usina</TableHead>
                  <TableHead>Registros</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(overview?.presenceRanking ?? []).map((item) => (
                  <TableRow key={item.plantId}>
                    <TableCell>{item.plantName}</TableCell>
                    <TableCell>{item.records}</TableCell>
                    <TableCell>{formatMinutes(item.totalMinutes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
