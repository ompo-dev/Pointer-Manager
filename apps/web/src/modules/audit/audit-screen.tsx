"use client";

import { useEffect } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { ScrollText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { useAuditStore } from "@/store/audit-store";

export function AuditScreen() {
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const [action, setAction] = useQueryState("action", parseAsString.withDefault(""));
  const [entity, setEntity] = useQueryState("entity", parseAsString.withDefault(""));
  const logs = useAuditStore((state) => state.logs);
  const feedback = useAuditStore((state) => state.feedback);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auditoria</CardTitle>
        <CardDescription>
          Login administrativo, alteracoes de ponto, encerramentos e acoes sensiveis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input value={search} onChange={(event) => void setSearch(event.target.value)} placeholder="Buscar por acao ou entidade" />
          <Input value={action} onChange={(event) => void setAction(event.target.value)} placeholder="Filtro de acao" />
          <Input value={entity} onChange={(event) => void setEntity(event.target.value)} placeholder="Filtro de entidade" />
        </div>
        {feedback ? (
          <p className="rounded-2xl border border-line bg-black/5 px-4 py-3 text-sm">{feedback}</p>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Acao</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Contexto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                <TableCell>
                  <p className="font-semibold">{item.action}</p>
                  <p className="text-sm text-muted-foreground">{item.entity}</p>
                </TableCell>
                <TableCell>{item.actorUser?.name ?? "-"}</TableCell>
                <TableCell>
                  <p className="text-sm">{item.entityId ?? "-"}</p>
                  <p className="text-sm text-muted-foreground">{item.ipAddress ?? "-"}</p>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!logs.length ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted">
            <ScrollText className="size-4" />
            Nenhum log encontrado com os filtros atuais.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
