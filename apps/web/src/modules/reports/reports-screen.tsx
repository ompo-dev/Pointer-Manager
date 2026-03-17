"use client";

import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { parseAsString, useQueryState } from "nuqs";
import { Download, FileBarChart2, FileText } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { SearchableCombobox, type SearchableOption } from "@/components/ui/searchable-combobox";
import { downloadReportExport, type ReportsSummary } from "@/lib/api/reports";
import {
  showErrorToast,
  showLoadingToast,
  showSuccessToast,
} from "@/lib/toast";
import { formatMinutes } from "@/lib/utils";
import { useReportsStore } from "@/store/reports-store";
import { resolveErrorMessage } from "@/store/store-utils";

type HoursByPersonRow = ReportsSummary["hoursByPerson"][number];
type HoursByPlantRow = ReportsSummary["hoursByPlant"][number];
type PresenceRow = ReportsSummary["presence"][number];
type OvertimeRow = ReportsSummary["overtime"][number];

export function ReportsScreen() {
  const [plant] = useQueryState("plant", parseAsString.withDefault(""));
  const [from, setFrom] = useQueryState("from", parseAsString.withDefault(""));
  const [to, setTo] = useQueryState("to", parseAsString.withDefault(""));
  const [reportType, setReportType] = useQueryState(
    "type",
    parseAsString.withDefault("hours-by-person"),
  );
  const [exportingFormat, setExportingFormat] = useState<"csv" | "pdf" | null>(
    null,
  );
  const plantOptions = useReportsStore((state) => state.plantOptions);
  const summary = useReportsStore((state) => state.summary);
  const feedback = useReportsStore((state) => state.feedback);
  const currentPlant = plantOptions.find((item) => item.id === plant) ?? null;
  const reportTypeOptions = useMemo<SearchableOption[]>(
    () => [
      { value: "hours-by-person", label: "Horas por pessoa" },
      { value: "hours-by-plant", label: "Horas por usina" },
      { value: "presence", label: "Presenca e faltas" },
      { value: "overtime", label: "Horas extras" },
    ],
    [],
  );
  const hoursByPersonColumns = useMemo<ColumnDef<HoursByPersonRow>[]>(
    () => [
      { accessorKey: "fullName", header: "Pessoa" },
      { accessorKey: "employer", header: "Empresa" },
      {
        accessorKey: "totalMinutes",
        header: "Total",
        cell: ({ row }) => formatMinutes(row.original.totalMinutes),
      },
    ],
    [],
  );
  const hoursByPlantColumns = useMemo<ColumnDef<HoursByPlantRow>[]>(
    () => [
      { accessorKey: "plantName", header: "Usina" },
      { accessorKey: "records", header: "Registros" },
      {
        accessorKey: "totalMinutes",
        header: "Total",
        cell: ({ row }) => formatMinutes(row.original.totalMinutes),
      },
    ],
    [],
  );
  const presenceColumns = useMemo<ColumnDef<PresenceRow>[]>(
    () => [
      { accessorKey: "fullName", header: "Pessoa" },
      { accessorKey: "presentDays", header: "Dias presentes" },
      { accessorKey: "absences", header: "Faltas" },
    ],
    [],
  );
  const overtimeColumns = useMemo<ColumnDef<OvertimeRow>[]>(
    () => [
      { accessorKey: "fullName", header: "Pessoa" },
      { accessorKey: "plantName", header: "Usina" },
      {
        accessorKey: "extraMinutes",
        header: "Extra",
        cell: ({ row }) => formatMinutes(row.original.extraMinutes),
      },
    ],
    [],
  );

  async function handleExport(format: "csv" | "pdf") {
    setExportingFormat(format);
    const toastId = showLoadingToast(
      format === "pdf" ? "Exportando PDF" : "Exportando CSV",
      "Gerando o arquivo do relatorio selecionado.",
    );

    try {
      const fileName = await downloadReportExport({
        type: reportType as
          | "hours-by-person"
          | "hours-by-plant"
          | "presence"
          | "overtime",
        format,
        plantId: plant || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      showSuccessToast("Relatorio exportado", fileName, { id: toastId });
    } catch (error) {
      showErrorToast(
        "Falha ao exportar relatorio",
        resolveErrorMessage(error, "Nao foi possivel exportar o relatorio."),
        { id: toastId },
      );
    } finally {
      setExportingFormat(null);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Relatorios</CardTitle>
          <CardDescription>
            {currentPlant
              ? `Horas, presenca e extras consolidados da usina ${currentPlant.name}.`
              : "Os relatorios seguem a usina selecionada no contexto do painel."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <DateRangePicker
            from={from}
            to={to}
            onChange={(range) => {
              void setFrom(range.from);
              void setTo(range.to);
            }}
            placeholder="Selecionar periodo"
          />
          <SearchableCombobox
            value={reportType}
            onValueChange={(value) => void setReportType(value || "hours-by-person")}
            options={reportTypeOptions}
            placeholder="Tipo de relatorio"
            searchPlaceholder="Buscar relatorio..."
            emptyMessage="Nenhum relatorio encontrado."
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleExport("csv")}
            disabled={exportingFormat !== null}
            className="h-11 justify-center gap-2 rounded-2xl"
          >
            <Download className="size-4" />
            {exportingFormat === "csv" ? "Exportando CSV..." : "Exportar CSV"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleExport("pdf")}
            disabled={exportingFormat !== null}
            className="h-11 justify-center gap-2 rounded-2xl"
          >
            <FileText className="size-4" />
            {exportingFormat === "pdf" ? "Exportando PDF..." : "Exportar PDF"}
          </Button>
        </CardContent>
      </Card>

      {feedback ? (
        <p className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
          {feedback}
        </p>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Horas por pessoa</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={summary?.hoursByPerson ?? []}
              columns={hoursByPersonColumns}
              getRowId={(item) => item.personId}
              queryStateScope="reportsHoursByPerson"
              showColumnVisibilityToggle={false}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Horas por usina</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={summary?.hoursByPlant ?? []}
              columns={hoursByPlantColumns}
              getRowId={(item) => item.plantId}
              queryStateScope="reportsHoursByPlant"
              showColumnVisibilityToggle={false}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Presenca</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={summary?.presence ?? []}
              columns={presenceColumns}
              getRowId={(item) => item.personId}
              queryStateScope="reportsPresence"
              showColumnVisibilityToggle={false}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Horas extras</CardTitle>
            <CardDescription>
              Registros acima de 8h para apoio ao fechamento e analise operacional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={summary?.overtime ?? []}
              columns={overtimeColumns}
              getRowId={(item) => item.entryId}
              queryStateScope="reportsOvertime"
              showColumnVisibilityToggle={false}
            />
            {!summary?.overtime?.length ? (
              <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <FileBarChart2 className="size-4" />
                Nenhuma hora extra encontrada no periodo.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
