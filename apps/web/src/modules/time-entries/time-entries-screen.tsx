"use client";

import { useEffect } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { Bot, Clock3, RefreshCw, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatMinutes } from "@/lib/utils";
import { useTimeEntriesStore } from "@/store/time-entries-store";

export function TimeEntriesScreen() {
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState("status", parseAsString.withDefault("ALL"));
  const [plantId, setPlantId] = useQueryState("plantId", parseAsString.withDefault(""));
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
  const setSelectedEntryId = useTimeEntriesStore((state) => state.setSelectedEntryId);
  const setAdjustField = useTimeEntriesStore((state) => state.setAdjustField);
  const closeSelectedEntry = useTimeEntriesStore((state) => state.closeSelectedEntry);
  const adjustSelectedEntry = useTimeEntriesStore((state) => state.adjustSelectedEntry);
  const runAutoClose = useTimeEntriesStore((state) => state.runAutoClose);

  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Registros de acesso</CardTitle>
            <CardDescription>
              Filtros por usina, pessoa, periodo e status com ajuste administrativo e fechamento manual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Input
                value={search}
                onChange={(event) => void setSearch(event.target.value)}
                placeholder="Pessoa, CPF ou usina"
              />
              <Select value={status} onChange={(event) => void setStatus(event.target.value)}>
                <option value="ALL">Todos os status</option>
                <option value="OPEN">Aberto</option>
                <option value="CLOSED">Finalizado</option>
                <option value="ADJUSTED">Ajustado</option>
                <option value="AUTO_CLOSED">Auto fechado</option>
              </Select>
              <Select value={plantId} onChange={(event) => void setPlantId(event.target.value)}>
                <option value="">Todas as usinas</option>
                {plantOptions.map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.name}
                  </option>
                ))}
              </Select>
              <Input type="date" value={from} onChange={(event) => void setFrom(event.target.value)} />
              <Input type="date" value={to} onChange={(event) => void setTo(event.target.value)} />
            </div>
            <div className="flex justify-stretch sm:justify-end">
              <Button className="w-full sm:w-auto" variant="secondary" onClick={() => void runAutoClose(plantId || undefined)} disabled={autoClosing}>
                <Bot className="mr-2 size-4" />
                {autoClosing ? "Executando..." : "Rodar auto-close"}
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Usina</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tempo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedEntryId(entry.id)}
                  >
                    <TableCell>
                      <p className="font-semibold">{entry.employee.fullName}</p>
                      <p className="text-sm text-muted-foreground">{entry.employee.personType}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">{entry.plant.name}</p>
                      <p className="text-sm text-muted-foreground">{formatDateTime(entry.openedAt)}</p>
                    </TableCell>
                    <TableCell>{entry.status}</TableCell>
                    <TableCell>{formatMinutes(entry.totalMinutes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acao sobre o registro</CardTitle>
            <CardDescription>
              Encerramento manual, ajuste de entrada/saida e observacoes administrativas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedEntry ? (
              <>
                <div className="rounded-2xl border border-line bg-white/70 p-4">
                  <p className="font-semibold">{selectedEntry.employee.fullName}</p>
                  <p className="text-sm text-muted">
                    {selectedEntry.employee.cpf} | {selectedEntry.plant.name}
                  </p>
                  <div className="mt-3 space-y-1 text-sm">
                    <p>Status atual: {selectedEntry.status}</p>
                    <p>Validacao: {selectedEntry.validationMode ?? "-"}</p>
                    <p>Observacao: {selectedEntry.validationNotes ?? "-"}</p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <Input
                    type="datetime-local"
                    value={adjustForm.openedAt}
                    onChange={(event) => setAdjustField("openedAt", event.target.value)}
                  />
                  <Input
                    type="datetime-local"
                    value={adjustForm.closedAt}
                    onChange={(event) => setAdjustField("closedAt", event.target.value)}
                  />
                  <Select value={adjustForm.status} onChange={(event) => setAdjustField("status", event.target.value)}>
                    <option value="ADJUSTED">Ajustado</option>
                    <option value="CLOSED">Finalizado</option>
                    <option value="AUTO_CLOSED">Auto fechado</option>
                  </Select>
                  <textarea
                    className="min-h-[120px] w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none"
                    value={adjustForm.notes}
                    onChange={(event) => setAdjustField("notes", event.target.value)}
                    placeholder="Observacoes do ajuste"
                  />
                </div>

                {feedback ? (
                  <p className="rounded-2xl border border-line bg-black/5 px-4 py-3 text-sm">
                    {feedback}
                  </p>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button className="w-full" onClick={() => void adjustSelectedEntry()} disabled={adjusting}>
                    <RefreshCw className="mr-2 size-4" />
                    {adjusting ? "Ajustando..." : "Salvar ajuste"}
                  </Button>
                  <Button className="w-full" variant="secondary" onClick={() => void closeSelectedEntry()} disabled={closing}>
                    <TimerReset className="mr-2 size-4" />
                    {closing ? "Encerrando..." : "Encerrar manualmente"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="inline-flex items-center gap-2 text-sm text-muted">
                <Clock3 className="size-4" />
                Selecione um registro na tabela.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
