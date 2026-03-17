"use client";

import { useEffect, useMemo, useRef } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import gsap from "gsap";
import { parseAsString, useQueryState } from "nuqs";
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis } from "recharts";
import {
  Activity,
  AlertTriangle,
  Building2,
  DoorOpen,
  FilePenLine,
  LogIn,
  LogOut,
  Network,
  PlugZap,
  TimerReset,
  UsersRound,
} from "lucide-react";
import { DataTable } from "@/components/data-table";
import { invalidateQueryCache } from "@/lib/api/query-cache";
import { useLiveOperationsFeed } from "@/lib/realtime/use-live-operations-feed";
import type {
  LiveFeedStatus,
  LiveOperationsEvent,
} from "@/lib/realtime/operations-types";
import { RealtimeBadge, TimeEntryStatusBadge } from "@/components/status-badges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { type DashboardOverview } from "@/lib/api/dashboard";
import {
  formatDateTime,
  formatMinutes,
  formatPersonTypeLabel,
} from "@/lib/utils";
import { useDashboardStore } from "@/store/dashboard-store";

type LiveEntryRow = DashboardOverview["liveEntries"][number];
type PresenceRankingRow = DashboardOverview["presenceRanking"][number];

function readPayloadText(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function readPayloadNumber(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "number" ? value : null;
}

function formatRealtimeStatusLabel(status: LiveFeedStatus) {
  if (status === "connected") {
    return "Conectado";
  }

  if (status === "connecting") {
    return "Conectando";
  }

  return "Offline";
}

function describeOperationalEvent(event: LiveOperationsEvent) {
  const personName = readPayloadText(event.payload, "personName");
  const plantName = readPayloadText(event.payload, "plantName");
  const openedAt = readPayloadText(event.payload, "openedAt");
  const totalMinutes = readPayloadNumber(event.payload, "totalMinutes");
  const snapshotMessage = readPayloadText(event.payload, "message");

  if (event.type === "entry.created") {
    return {
      icon: LogIn,
      title: `${personName ?? "Uma pessoa"} entrou na usina`,
      description: plantName
        ? `Entrada registrada em ${plantName}.`
        : "Uma nova entrada foi registrada.",
      details: openedAt ? `Inicio do acesso: ${formatDateTime(openedAt)}` : null,
    };
  }

  if (event.type === "entry.closed") {
    return {
      icon: LogOut,
      title: `${personName ?? "Uma pessoa"} saiu da usina`,
      description: plantName
        ? `Saida registrada em ${plantName}.`
        : "Uma saida foi registrada.",
      details:
        typeof totalMinutes === "number"
          ? `Tempo total de permanencia: ${formatMinutes(totalMinutes)}`
          : null,
    };
  }

  if (event.type === "entry.adjusted") {
    return {
      icon: FilePenLine,
      title: `${personName ?? "Um registro"} foi ajustado`,
      description: plantName
        ? `Os dados do acesso em ${plantName} foram atualizados.`
        : "Os dados do acesso foram atualizados.",
      details: openedAt ? `Horario principal: ${formatDateTime(openedAt)}` : null,
    };
  }

  return {
    icon: PlugZap,
    title: "Canal em tempo real ativo",
    description:
      snapshotMessage ?? "O painel esta recebendo atualizacoes automaticamente.",
    details: null,
  };
}

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
      <CardContent className="flex items-center justify-between gap-4 p-4 sm:p-4.5">
        <div className="min-w-0 space-y-1">
          <CardDescription className="line-clamp-2 text-[11px] uppercase tracking-[0.18em]">
            {label}
          </CardDescription>
          <p ref={nodeRef} className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
            0
          </p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/60">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardScreen() {
  const [plant] = useQueryState("plant", parseAsString.withDefault(""));
  const overview = useDashboardStore((state) => state.overview);
  const plants = useDashboardStore((state) => state.plants);
  const error = useDashboardStore((state) => state.error);
  const loadingOverview = useDashboardStore((state) => state.loadingOverview);
  const loadOverview = useDashboardStore((state) => state.loadOverview);
  const hasConnectedOnceRef = useRef(false);
  const previousRealtimeStatusRef = useRef<LiveFeedStatus>("connecting");
  const currentPlant = plants.find((item) => item.id === plant) ?? null;
  const { events, status } = useLiveOperationsFeed(plant || undefined, {
    onEvent: (event) => {
      if (event.type === "presence.snapshot") {
        return;
      }

      invalidateQueryCache(["dashboard-overview"]);
      void loadOverview(plant || undefined);
    },
  });
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
  const rankingColumns = useMemo<ColumnDef<PresenceRankingRow>[]>(
    () => [
      {
        accessorKey: "plantName",
        header: "Usina",
        cell: ({ row }) => row.original.plantName,
      },
      {
        accessorKey: "records",
        header: "Registros",
        cell: ({ row }) => row.original.records,
      },
      {
        accessorKey: "totalMinutes",
        header: "Total",
        cell: ({ row }) => formatMinutes(row.original.totalMinutes),
      },
    ],
    [],
  );
  const liveEntryColumns = useMemo<ColumnDef<LiveEntryRow>[]>(
    () => [
      {
        accessorKey: "personName",
        header: "Pessoa",
        cell: ({ row }) => (
          <div className="space-y-1 whitespace-normal">
            <p className="font-semibold">{row.original.personName}</p>
            <p className="text-sm text-muted-foreground">
              {formatPersonTypeLabel(row.original.personType)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "plantName",
        header: "Usina",
        cell: ({ row }) => row.original.plantName,
      },
      {
        accessorKey: "openedAt",
        header: "Entrada",
        cell: ({ row }) => formatDateTime(row.original.openedAt),
      },
      {
        accessorKey: "elapsedMinutes",
        header: "Tempo em aberto",
        cell: ({ row }) => formatMinutes(row.original.elapsedMinutes),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <TimeEntryStatusBadge status={row.original.status} />,
      },
    ],
    [],
  );

  const chartConfig = {
    minutes: {
      label: "Minutos",
      color: "hsl(var(--accent))",
    },
  } satisfies ChartConfig;

  useEffect(() => {
    if (status !== "connected") {
      previousRealtimeStatusRef.current = status;
      return;
    }

    if (!hasConnectedOnceRef.current) {
      hasConnectedOnceRef.current = true;
      previousRealtimeStatusRef.current = status;
      return;
    }

    if (previousRealtimeStatusRef.current !== "connected") {
      invalidateQueryCache(["dashboard-overview"]);
      void loadOverview(plant || undefined);
    }

    previousRealtimeStatusRef.current = status;
  }, [loadOverview, plant, status]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Card className="overflow-hidden">
          <CardContent className="grid-paper relative min-h-[280px] p-5 sm:p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/70 to-transparent" />
            <div className="relative flex h-full flex-col justify-between gap-6">
              <div className="space-y-5">
                <div className="space-y-3">
                  <RealtimeBadge label="Atualizacao em tempo real" />
                  <div className="space-y-2">
                    <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
                      Painel operacional para acompanhar entradas, saidas e alertas das usinas.
                    </h1>
                    <p className="max-w-2xl text-sm leading-7 text-muted">
                      {currentPlant
                        ? `Contexto ativo: ${currentPlant.name} em ${currentPlant.city} - ${currentPlant.state}. Todos os indicadores abaixo seguem essa usina.`
                        : "Selecione uma usina no contexto do painel para carregar os indicadores operacionais."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 text-sm text-muted sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <span className="inline-flex items-center gap-2">
                  <Network className="size-4" />
                  Tempo real: {formatRealtimeStatusLabel(status)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Activity className="size-4" />
                  Atualizacoes recentes: {timeline.length}
                </span>
                {currentPlant ? <span>usina: {currentPlant.name}</span> : null}
                {loadingOverview ? <span>atualizando painel...</span> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feed operacional</CardTitle>
            <CardDescription>
              Movimentacoes recentes recebidas automaticamente pelo painel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted">Nenhum evento novo chegou ainda.</p>
            ) : (
              timeline.map((event) => {
                const eventCopy = describeOperationalEvent(event);
                const EventIcon = eventCopy.icon;

                return (
                  <div
                    key={`${event.type}-${event.createdAt}`}
                    className="rounded-2xl border border-border bg-card/70 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/50">
                          <EventIcon className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{eventCopy.title}</p>
                          <p className="break-words text-sm text-muted">
                            {eventCopy.description}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-xs text-muted">
                        {new Date(event.createdAt).toLocaleTimeString("pt-BR")}
                      </span>
                    </div>
                    {eventCopy.details ? (
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {eventCopy.details}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>

      {error ? (
        <p className="rounded-2xl border border-border bg-muted/70 px-4 py-3 text-sm">{error}</p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <AnimatedMetric
          label="Pessoas ativas"
          value={overview?.activePeople ?? 0}
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
          value={overview?.peopleWithoutExit ?? 0}
          icon={DoorOpen}
        />
        <AnimatedMetric
          label="Usinas com atividade"
          value={overview?.plantsWithActivityToday ?? 0}
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
          <CardContent>
            <DataTable
              data={overview?.liveEntries ?? []}
              columns={liveEntryColumns}
              getRowId={(item) => item.id}
              queryStateScope="dashboardLiveEntries"
              enablePagination={false}
              showColumnVisibilityToggle={false}
              emptyMessage="Nenhum acesso em aberto no momento."
            />
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
                className="rounded-2xl border border-amber-300/50 bg-amber-500/10 px-4 py-4 text-amber-900 dark:text-amber-100"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-4" />
                  <div>
                    <p className="font-semibold">{alert.personName}</p>
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
            <DataTable
              data={overview?.presenceRanking ?? []}
              columns={rankingColumns}
              getRowId={(item) => item.plantId}
              queryStateScope="dashboardPresence"
              enablePagination={false}
              showColumnVisibilityToggle={false}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
