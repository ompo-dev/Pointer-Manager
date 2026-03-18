"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { parseAsString, useQueryState } from "nuqs";
import {
  Bot,
  Clock3,
  MapPinned,
  MonitorSmartphone,
  RefreshCw,
  TimerReset,
  Wifi,
} from "lucide-react";
import { DataTable } from "@/components/data-table";
import { TimeEntryStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import {
  SearchableCombobox,
  type SearchableOption,
} from "@/components/ui/searchable-combobox";
import { Textarea } from "@/components/ui/textarea";
import { type TimeEntryRecord } from "@/lib/api/time-entries";
import {
  formatDateTime,
  formatMinutes,
  formatPersonTypeLabel,
  formatTimeEntryOriginLabel,
  formatTimeEntryStatusLabel,
  formatValidationModeLabel,
} from "@/lib/utils";
import { useOperationsRealtimeRefresh } from "@/lib/realtime/use-operations-realtime-refresh";
import { useTimeEntriesStore } from "@/store/time-entries-store";

export function TimeEntriesScreen() {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsString.withDefault("ALL"),
  );
  const [plant] = useQueryState("plant", parseAsString.withDefault(""));
  const [from, setFrom] = useQueryState("from", parseAsString.withDefault(""));
  const [to, setTo] = useQueryState("to", parseAsString.withDefault(""));
  const entries = useTimeEntriesStore((state) => state.entries);
  const plantOptions = useTimeEntriesStore((state) => state.plantOptions);
  const selectedEntryId = useTimeEntriesStore((state) => state.selectedEntryId);
  const adjustForm = useTimeEntriesStore((state) => state.adjustForm);
  const feedback = useTimeEntriesStore((state) => state.feedback);
  const closing = useTimeEntriesStore((state) => state.closing);
  const adjusting = useTimeEntriesStore((state) => state.adjusting);
  const autoClosing = useTimeEntriesStore((state) => state.autoClosing);
  const setSelectedEntryId = useTimeEntriesStore(
    (state) => state.setSelectedEntryId,
  );
  const setAdjustField = useTimeEntriesStore((state) => state.setAdjustField);
  const closeSelectedEntry = useTimeEntriesStore(
    (state) => state.closeSelectedEntry,
  );
  const adjustSelectedEntry = useTimeEntriesStore(
    (state) => state.adjustSelectedEntry,
  );
  const runAutoClose = useTimeEntriesStore((state) => state.runAutoClose);

  const selectedEntry =
    entries.find((entry) => entry.id === selectedEntryId) ?? null;
  const currentPlant = plantOptions.find((item) => item.id === plant) ?? null;
  const statusOptions = useMemo<SearchableOption[]>(
    () => [
      { value: "ALL", label: "Todos os status" },
      { value: "OPEN", label: "Aberto" },
      { value: "CLOSED", label: "Finalizado" },
      { value: "ADJUSTED", label: "Ajustado" },
      { value: "AUTO_CLOSED", label: "Auto fechado" },
    ],
    [],
  );
  const adjustStatusOptions = useMemo(
    () => statusOptions.filter((option) => option.value !== "ALL"),
    [statusOptions],
  );

  useOperationsRealtimeRefresh({
    plantId: plant || undefined,
    matchers: ["time-entries"],
    onRefresh: () =>
      useTimeEntriesStore.getState().loadEntries(
        {
          search,
          status,
          plantId: plant || undefined,
          from: from || undefined,
          to: to || undefined,
        },
        { preserveDraft: true },
      ),
  });

  const columns = useMemo<ColumnDef<TimeEntryRecord>[]>(
    () => [
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
        cell: ({ row }) => (
          <div className="space-y-1 whitespace-normal">
            <p className="font-semibold">{row.original.plant.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatDateTime(row.original.openedAt)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <TimeEntryStatusBadge status={row.original.status} />
        ),
      },
      {
        accessorKey: "totalMinutes",
        header: "Tempo",
        cell: ({ row }) => formatMinutes(row.original.totalMinutes ?? row.original.elapsedMinutes),
      },
    ],
    [],
  );

  function renderEntryDetails() {
    if (!selectedEntry) {
      return (
        <div className="p-4 sm:p-6">
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="size-4" />
            Selecione um registro na tabela.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Acao sobre o registro</h3>
          <p className="text-sm text-muted-foreground">
            Encerramento manual, ajuste de entrada/saida e observacoes
            administrativas.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Resumo do registro</CardTitle>
              <CardDescription>
                {selectedEntry.person.fullName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
                <p className="break-words font-semibold">
                  {selectedEntry.person.fullName}
                </p>
                <p className="break-words text-sm text-muted-foreground">
                  {selectedEntry.person.cpf} | {selectedEntry.plant.name}
                </p>
                <div className="mt-3 min-w-0 space-y-1 text-sm">
                  <p className="break-words">
                    Status atual: {formatTimeEntryStatusLabel(selectedEntry.status)}
                  </p>
                  <p className="break-words">
                    Validacao: {formatValidationModeLabel(selectedEntry.validationMode)}
                  </p>
                  <p className="break-words">
                    Observacao: {selectedEntry.validationNotes ?? "-"}
                  </p>
                </div>
              </div>

              <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Contexto de acesso
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="min-w-0 rounded-2xl border border-border bg-background p-3 text-sm">
                    <p className="inline-flex items-center gap-2 font-semibold">
                      <Wifi className="size-4 text-muted-foreground" />
                      Rede observada
                    </p>
                    <div className="mt-2 min-w-0 space-y-1 text-muted-foreground">
                      <p className="break-words">
                        {selectedEntry.wifiSsid ?? "Sem SSID informado"}
                      </p>
                      <p className="break-all">
                        {selectedEntry.wifiBssid ?? "Sem BSSID informado"}
                      </p>
                      <p className="break-all">
                        IP: {selectedEntry.deviceIp ?? "Nao capturado"}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-border bg-background p-3 text-sm">
                    <p className="inline-flex items-center gap-2 font-semibold">
                      <MonitorSmartphone className="size-4 text-muted-foreground" />
                      Dispositivo
                    </p>
                    <div className="mt-2 min-w-0 space-y-1 text-muted-foreground">
                      <p className="break-words">
                        {selectedEntry.deviceLabel ?? "Nao identificado"}
                      </p>
                      <p className="break-words">
                        Origem: {formatTimeEntryOriginLabel(selectedEntry.origin)}
                      </p>
                      <p className="break-words">
                        Modo: {formatValidationModeLabel(selectedEntry.validationMode)}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-border bg-background p-3 text-sm sm:col-span-2">
                    <p className="inline-flex items-center gap-2 font-semibold">
                      <MapPinned className="size-4 text-muted-foreground" />
                      Localizacao e observacoes
                    </p>
                    <div className="mt-2 min-w-0 space-y-1 text-muted-foreground">
                      <p className="break-words">
                        {selectedEntry.geoLatitude !== null &&
                        selectedEntry.geoLatitude !== undefined &&
                        selectedEntry.geoLongitude !== null &&
                        selectedEntry.geoLongitude !== undefined
                          ? `${selectedEntry.geoLatitude.toFixed(6)}, ${selectedEntry.geoLongitude.toFixed(6)}`
                          : "Sem geolocalizacao capturada"}
                      </p>
                      <p className="break-words">
                        {selectedEntry.validationNotes ??
                          "Sem observacao tecnica."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ajuste administrativo</CardTitle>
              <CardDescription>
                Entrada, saida e encerramento manual.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <Input
                  type="datetime-local"
                  value={adjustForm.openedAt}
                  onChange={(event) =>
                    setAdjustField("openedAt", event.target.value)
                  }
                />
                <Input
                  type="datetime-local"
                  value={adjustForm.closedAt}
                  onChange={(event) =>
                    setAdjustField("closedAt", event.target.value)
                  }
                />
                <SearchableCombobox
                  value={adjustForm.status}
                  onValueChange={(value) => setAdjustField("status", value)}
                  options={adjustStatusOptions}
                  placeholder="Selecione o status"
                  searchPlaceholder="Buscar status..."
                  emptyMessage="Nenhum status encontrado."
                />
                <Textarea
                  value={adjustForm.notes}
                  onChange={(event) =>
                    setAdjustField("notes", event.target.value)
                  }
                  placeholder="Observacoes do ajuste"
                />
              </div>

              {feedback ? (
                <p className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
                  {feedback}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  className="w-full"
                  onClick={() => void adjustSelectedEntry()}
                  disabled={adjusting}
                >
                  <RefreshCw className="mr-2 size-4" />
                  {adjusting ? "Ajustando..." : "Salvar ajuste"}
                </Button>
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => void closeSelectedEntry()}
                  disabled={closing}
                >
                  <TimerReset className="mr-2 size-4" />
                  {closing ? "Encerrando..." : "Encerrar manualmente"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Registros de acesso</CardTitle>
            <CardDescription>
              {currentPlant
                ? `Registros da usina ${currentPlant.name} com ajuste administrativo e fechamento manual.`
                : "Registros filtrados pela usina selecionada no contexto do painel."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={entries}
              columns={columns}
              getRowId={(entry) => entry.id}
              queryStateScope="timeEntriesList"
              onRowClick={(entry) => {
                if (entry.id === selectedEntryId) {
                  setSelectedEntryId(null);
                  return;
                }

                setSelectedEntryId(entry.id);
              }}
              isRowActive={(entry) => entry.id === selectedEntryId}
              expandedRowId={selectedEntryId}
              getDetailTitle={(row) => row.person.fullName}
              getDetailDescription={(row) => `${row.plant.name} | ${formatDateTime(row.openedAt)}`}
              renderInlineDetails={(row) =>
                selectedEntry?.id === row.id ? (
                  <div className="bg-muted/10">{renderEntryDetails()}</div>
                ) : null
              }
              toolbar={
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Input
                    value={search}
                    onChange={(event) => void setSearch(event.target.value)}
                    placeholder="Pessoa, CPF ou usina"
                  />
                  <SearchableCombobox
                    value={status}
                    onValueChange={(value) => void setStatus(value || "ALL")}
                    options={statusOptions}
                    placeholder="Todos os status"
                    searchPlaceholder="Buscar status..."
                    emptyMessage="Nenhum status encontrado."
                  />
                  <DateRangePicker
                    from={from}
                    to={to}
                    onChange={(range) => {
                      void setFrom(range.from);
                      void setTo(range.to);
                    }}
                    placeholder="Selecionar periodo"
                  />
                </div>
              }
              actions={
                <Button
                  className="w-full sm:w-auto"
                  variant="secondary"
                  onClick={() => void runAutoClose(plant || undefined)}
                  disabled={autoClosing}
                >
                  <Bot className="mr-2 size-4" />
                  {autoClosing ? "Executando..." : "Rodar auto-close"}
                </Button>
              }
              emptyMessage="Nenhum registro encontrado."
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
