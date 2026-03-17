"use client";

import { useEffect, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { parseAsString, useQueryState } from "nuqs";
import { Clock3, DoorClosed, RefreshCw, UsersRound } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type TimeEntryRecord } from "@/lib/api/time-entries";
import { useOperationsRealtimeRefresh } from "@/lib/realtime/use-operations-realtime-refresh";
import {
  formatDateTime,
  formatMinutes,
  formatPersonTypeLabel,
} from "@/lib/utils";
import { useActiveAccessStore } from "@/store/active-access-store";

export function ActiveAccessScreen() {
  const [plant] = useQueryState("plant", parseAsString.withDefault(""));
  const entries = useActiveAccessStore((state) => state.entries);
  const plantOptions = useActiveAccessStore((state) => state.plantOptions);
  const feedback = useActiveAccessStore((state) => state.feedback);
  const loading = useActiveAccessStore((state) => state.loading);
  const closingEntryId = useActiveAccessStore((state) => state.closingEntryId);
  const loadEntries = useActiveAccessStore((state) => state.loadEntries);
  const loadPlantOptions = useActiveAccessStore((state) => state.loadPlantOptions);
  const closeEntry = useActiveAccessStore((state) => state.closeEntry);
  const currentPlant = plantOptions.find((item) => item.id === plant) ?? null;

  useEffect(() => {
    void loadPlantOptions();
  }, [loadPlantOptions]);

  useEffect(() => {
    void loadEntries(plant || undefined);
  }, [loadEntries, plant]);

  useOperationsRealtimeRefresh({
    plantId: plant || undefined,
    matchers: ["live-time-entries"],
    onRefresh: () => loadEntries(plant || undefined),
  });

  const totalElapsedMinutes = useMemo(
    () => entries.reduce((total, entry) => total + entry.elapsedMinutes, 0),
    [entries],
  );

  const columns = useMemo<ColumnDef<TimeEntryRecord>[]>(() => [
    {
      accessorKey: "person.fullName",
      header: "Pessoa",
      cell: ({ row }) => (
        <div className="space-y-1 whitespace-normal">
          <p className="font-semibold">{row.original.person.fullName}</p>
          <p className="text-sm text-muted-foreground">
            {formatPersonTypeLabel(row.original.person.personType)} | {row.original.person.cpf}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "plant.name",
      header: "Usina",
      cell: ({ row }) => row.original.plant.name,
    },
    {
      accessorKey: "openedAt",
      header: "Entrada",
      cell: ({ row }) => formatDateTime(row.original.openedAt),
    },
    {
      accessorKey: "elapsedMinutes",
      header: "Tempo no local",
      cell: ({ row }) => formatMinutes(row.original.elapsedMinutes),
    },
    {
      id: "actions",
      header: "Acao",
      cell: ({ row }) => (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          data-no-row-click="true"
          disabled={closingEntryId === row.original.id}
          onClick={() => void closeEntry(row.original.id)}
        >
          <DoorClosed className="mr-2 size-4" />
          {closingEntryId === row.original.id ? "Encerrando..." : "Encerrar"}
        </Button>
      ),
    },
  ], [closeEntry, closingEntryId]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Pessoas presentes
              </p>
              <p className="font-mono text-3xl font-semibold">{entries.length}</p>
            </div>
            <UsersRound className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Tempo acumulado
              </p>
              <p className="font-mono text-3xl font-semibold">{formatMinutes(totalElapsedMinutes)}</p>
            </div>
            <Clock3 className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Contexto ativo
              </p>
              <p className="text-base font-semibold">{currentPlant?.name ?? "Todas as usinas"}</p>
            </div>
            <RefreshCw className={`size-5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Acessos ativos</CardTitle>
          <CardDescription>
            {currentPlant
              ? `Pessoas presentes agora em ${currentPlant.name}.`
              : "Lista de pessoas presentes agora, com tempo em aberto e encerramento manual."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedback ? (
            <p className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
              {feedback}
            </p>
          ) : null}

          <DataTable
            data={entries}
            columns={columns}
            getRowId={(entry) => entry.id}
            queryStateScope="activeAccess"
            showColumnVisibilityToggle={false}
            emptyMessage="Nenhum acesso ativo encontrado."
          />
        </CardContent>
      </Card>
    </div>
  );
}
