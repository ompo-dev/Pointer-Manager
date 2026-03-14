"use client";

import { useEffect } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { Download, FileBarChart2, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildReportExportUrl } from "@/lib/api/reports";
import { formatMinutes } from "@/lib/utils";
import { useReportsStore } from "@/store/reports-store";

export function ReportsScreen() {
  const [plantId, setPlantId] = useQueryState("plantId", parseAsString.withDefault(""));
  const [from, setFrom] = useQueryState("from", parseAsString.withDefault(""));
  const [to, setTo] = useQueryState("to", parseAsString.withDefault(""));
  const [reportType, setReportType] = useQueryState(
    "type",
    parseAsString.withDefault("hours-by-person"),
  );
  const plantOptions = useReportsStore((state) => state.plantOptions);
  const summary = useReportsStore((state) => state.summary);
  const feedback = useReportsStore((state) => state.feedback);

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Relatorios</CardTitle>
          <CardDescription>
            Horas por pessoa, horas por usina, presenca, faltas observadas e horas extras.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Select value={plantId} onChange={(event) => void setPlantId(event.target.value)}>
            <option value="">Todas as usinas</option>
            {plantOptions.map((plant) => (
              <option key={plant.id} value={plant.id}>
                {plant.name}
              </option>
            ))}
          </Select>
          <input
            type="date"
            className="h-11 rounded-2xl border border-line bg-white/90 px-4 text-sm"
            value={from}
            onChange={(event) => void setFrom(event.target.value)}
          />
          <input
            type="date"
            className="h-11 rounded-2xl border border-line bg-white/90 px-4 text-sm"
            value={to}
            onChange={(event) => void setTo(event.target.value)}
          />
          <Select value={reportType} onChange={(event) => void setReportType(event.target.value)}>
            <option value="hours-by-person">Horas por pessoa</option>
            <option value="hours-by-plant">Horas por usina</option>
            <option value="presence">Presenca e faltas</option>
            <option value="overtime">Horas extras</option>
          </Select>
          <a
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-line bg-white px-4 text-sm font-semibold"
            href={buildReportExportUrl({
              type: reportType as "hours-by-person" | "hours-by-plant" | "presence" | "overtime",
              format: "csv",
              plantId: plantId || undefined,
              from: from || undefined,
              to: to || undefined,
            })}
            target="_blank"
            rel="noreferrer"
          >
            <Download className="size-4" />
            Exportar CSV
          </a>
          <a
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-line bg-white px-4 text-sm font-semibold"
            href={buildReportExportUrl({
              type: reportType as "hours-by-person" | "hours-by-plant" | "presence" | "overtime",
              format: "pdf",
              plantId: plantId || undefined,
              from: from || undefined,
              to: to || undefined,
            })}
            target="_blank"
            rel="noreferrer"
          >
            <FileText className="size-4" />
            Exportar PDF
          </a>
        </CardContent>
      </Card>

      {feedback ? (
        <p className="rounded-2xl border border-line bg-black/5 px-4 py-3 text-sm">{feedback}</p>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Horas por pessoa</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(summary?.hoursByPerson ?? []).map((item) => (
                  <TableRow key={item.employeeId}>
                    <TableCell>{item.fullName}</TableCell>
                    <TableCell>{item.employer}</TableCell>
                    <TableCell>{formatMinutes(item.totalMinutes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Horas por usina</CardTitle>
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
                {(summary?.hoursByPlant ?? []).map((item) => (
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

        <Card>
          <CardHeader>
            <CardTitle>Presenca</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Dias presentes</TableHead>
                  <TableHead>Faltas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(summary?.presence ?? []).map((item) => (
                  <TableRow key={item.employeeId}>
                    <TableCell>{item.fullName}</TableCell>
                    <TableCell>{item.presentDays}</TableCell>
                    <TableCell>{item.absences}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Usina</TableHead>
                  <TableHead>Extra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(summary?.overtime ?? []).map((item) => (
                  <TableRow key={item.entryId}>
                    <TableCell>{item.fullName}</TableCell>
                    <TableCell>{item.plantName}</TableCell>
                    <TableCell>{formatMinutes(item.extraMinutes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!summary?.overtime?.length ? (
              <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
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
