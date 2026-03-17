"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { parseAsString, useQueryState } from "nuqs";
import { ScrollText } from "lucide-react";
import { DataTable } from "@/components/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type AuditLogEntry } from "@/lib/api/audit";
import { formatDateTime, formatMinutes } from "@/lib/utils";
import { useAuditStore } from "@/store/audit-store";

const auditActionLabels: Record<string, string> = {
  "AUTH.LOGIN": "Login administrativo",
  "TIME_ENTRY.OPENED": "Acesso iniciado",
  "TIME_ENTRY.CLOSED": "Acesso encerrado",
  "TIME_ENTRY.MANUAL_CLOSE": "Acesso encerrado manualmente",
  "TIME_ENTRY.ADJUSTED": "Registro ajustado",
  "TIME_ENTRY.AUTO_CLOSED": "Fechamento automatico",
  "PERSON.CREATED": "Pessoa criada",
  "PERSON.UPDATED": "Pessoa atualizada",
  "PLANT.CREATED": "Usina criada",
  "PLANT.UPDATED": "Usina atualizada",
  "ACCESS_USER.CREATED": "Usuario criado",
  "ACCESS_USER.UPDATED": "Usuario atualizado",
};

const auditEntityLabels: Record<string, string> = {
  AccessProfile: "Pessoa",
  Plant: "Usina",
  TimeEntry: "Registro de acesso",
  User: "Conta administrativa",
};

const userRoleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrador",
  PLANT_SUPERVISOR: "Supervisor de Usina",
};

const personTypeLabels: Record<string, string> = {
  EMPLOYEE: "Funcionario",
  CONTRACTOR: "Terceirizado",
  VISITOR: "Visitante",
  SUPERVISOR: "Supervisor",
  SERVICE_PROVIDER: "Prestador",
  OTHER: "Outro",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  LEAVE: "Afastado",
  OPEN: "Aberto",
  CLOSED: "Finalizado",
  ADJUSTED: "Ajustado",
  AUTO_CLOSED: "Auto fechado",
};

const moduleLabels: Record<string, string> = {
  dashboard: "Dashboard",
  plants: "Usinas",
  people: "Pessoas",
  "time-entries": "Registros",
  reports: "Relatorios",
  access: "Usuarios",
  audit: "Auditoria",
};

type AuditMetadata = Record<string, unknown>;
type AuditTextBlock = {
  primary: string;
  secondary?: string | null;
};

function isRecord(value: unknown): value is AuditMetadata {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function humanizeAuditToken(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeAuditValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === "number") {
    return `${value}`;
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "Nao";
  }

  return null;
}

function readFirstValue(record: AuditMetadata | null, keys: string[]) {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];

    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === "string" && !value.trim()) {
      continue;
    }

    return value;
  }

  return null;
}

function formatAuditAction(action: string) {
  return auditActionLabels[action] ?? humanizeAuditToken(action);
}

function formatAuditEntity(entity: string) {
  return auditEntityLabels[entity] ?? humanizeAuditToken(entity);
}

function formatUserRole(role?: string | null) {
  if (!role) {
    return null;
  }

  return userRoleLabels[role] ?? humanizeAuditToken(role);
}

function formatPersonType(personType?: string | null) {
  if (!personType) {
    return null;
  }

  return personTypeLabels[personType] ?? humanizeAuditToken(personType);
}

function formatStatus(status?: string | null) {
  if (!status) {
    return null;
  }

  return statusLabels[status] ?? humanizeAuditToken(status);
}

function formatModulePermissions(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const labels = value
    .map((item) =>
      typeof item === "string"
        ? moduleLabels[item] ?? humanizeAuditToken(item)
        : null,
    )
    .filter((item): item is string => Boolean(item));

  return labels.length > 0 ? labels.join(", ") : null;
}

function formatValidationMode(value?: string | null) {
  if (!value) {
    return null;
  }

  return humanizeAuditToken(value);
}

function formatCpf(value?: string | null) {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, "");

  if (digits.length !== 11) {
    return value;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function truncateText(value: string, maxLength = 72) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function summarizeSnapshot(snapshot: AuditMetadata | null) {
  if (!snapshot) {
    return null;
  }

  const details = [
    formatUserRole(normalizeAuditValue(readFirstValue(snapshot, ["role"]))),
    formatStatus(normalizeAuditValue(readFirstValue(snapshot, ["status"]))),
    formatPersonType(normalizeAuditValue(readFirstValue(snapshot, ["personType"]))),
    normalizeAuditValue(readFirstValue(snapshot, ["code"]))?.replace(/^/, "Codigo "),
    (() => {
      const city = normalizeAuditValue(readFirstValue(snapshot, ["city"]));
      const state = normalizeAuditValue(readFirstValue(snapshot, ["state"]));
      return [city, state].filter(Boolean).join(" / ") || null;
    })(),
    (() => {
      const moduleSummary = formatModulePermissions(
        readFirstValue(snapshot, ["modulePermissions"]),
      );
      return moduleSummary ? `Modulos: ${moduleSummary}` : null;
    })(),
    (() => {
      const lateAlertMinutes = normalizeAuditValue(
        readFirstValue(snapshot, ["lateAlertMinutes"]),
      );
      return lateAlertMinutes ? `Alerta apos ${lateAlertMinutes} min` : null;
    })(),
    (() => {
      const requireWifiMatch = readFirstValue(snapshot, ["requireWifiMatch"]);
      return typeof requireWifiMatch === "boolean"
        ? requireWifiMatch
          ? "Wi-Fi obrigatorio"
          : "Wi-Fi opcional"
        : null;
    })(),
    (() => {
      const requireSelfie = readFirstValue(snapshot, ["requireSelfie"]);
      return typeof requireSelfie === "boolean"
        ? requireSelfie
          ? "Selfie obrigatoria"
          : "Selfie opcional"
        : null;
    })(),
    (() => {
      const notes = normalizeAuditValue(readFirstValue(snapshot, ["notes"]));
      return notes ? `Observacao: ${truncateText(notes, 40)}` : null;
    })(),
  ].filter((item): item is string => Boolean(item));

  return details.slice(0, 2).join(" | ") || null;
}

function buildAuditChangeSummary(
  before: AuditMetadata | null,
  after: AuditMetadata | null,
) {
  const nextStatus = formatStatus(
    normalizeAuditValue(readFirstValue(after, ["status"])),
  );
  const previousStatus = formatStatus(
    normalizeAuditValue(readFirstValue(before, ["status"])),
  );

  if (nextStatus && previousStatus && nextStatus !== previousStatus) {
    return `Status: ${previousStatus} -> ${nextStatus}`;
  }

  const nextLateAlert = normalizeAuditValue(
    readFirstValue(after, ["lateAlertMinutes"]),
  );
  const previousLateAlert = normalizeAuditValue(
    readFirstValue(before, ["lateAlertMinutes"]),
  );

  if (nextLateAlert && previousLateAlert && nextLateAlert !== previousLateAlert) {
    return `Alerta de atraso: ${previousLateAlert} -> ${nextLateAlert} min`;
  }

  const nextModules = formatModulePermissions(
    readFirstValue(after, ["modulePermissions"]),
  );
  if (nextModules) {
    return `Modulos: ${nextModules}`;
  }

  const nextNotes = normalizeAuditValue(readFirstValue(after, ["notes"]));
  const previousNotes = normalizeAuditValue(readFirstValue(before, ["notes"]));

  if (nextNotes && nextNotes !== previousNotes) {
    return "Observacao atualizada";
  }

  return summarizeSnapshot(after) ?? summarizeSnapshot(before);
}

function formatAuditLocation(log: AuditLogEntry) {
  return log.ipAddress ? `IP ${log.ipAddress}` : null;
}

function getAuditContext(log: AuditLogEntry): AuditTextBlock {
  const metadata = isRecord(log.metadata) ? log.metadata : null;
  const beforeValue = metadata?.before;
  const afterValue = metadata?.after;
  const before = isRecord(beforeValue) ? beforeValue : null;
  const after = isRecord(afterValue) ? afterValue : null;
  const snapshot = after ?? before;
  const seedNote = log.entityId?.startsWith("seed-")
    ? "Carga inicial de 17/03/2026"
    : null;

  if (log.action === "AUTH.LOGIN") {
    const email =
      normalizeAuditValue(readFirstValue(metadata, ["email"])) ??
      log.actorUser?.email ??
      null;

    return {
      primary: email ? `Conta ${email}` : "Acesso ao painel administrativo",
      secondary:
        [
          formatUserRole(normalizeAuditValue(readFirstValue(metadata, ["role"]))),
          seedNote,
        ]
          .filter(Boolean)
          .join(" | ") || null,
    };
  }

  if (log.action.startsWith("PLANT.")) {
    const name = normalizeAuditValue(readFirstValue(snapshot, ["name"]));
    const code = normalizeAuditValue(readFirstValue(snapshot, ["code"]));
    const city = normalizeAuditValue(readFirstValue(snapshot, ["city"]));
    const state = normalizeAuditValue(readFirstValue(snapshot, ["state"]));

    return {
      primary: name ?? "Configuracao da usina",
      secondary:
        [
          code ? `Codigo ${code}` : null,
          [city, state].filter(Boolean).join(" / ") || null,
          buildAuditChangeSummary(before, after),
          seedNote,
        ]
          .filter(Boolean)
          .join(" | ") || null,
    };
  }

  if (log.action.startsWith("PERSON.")) {
    const fullName =
      normalizeAuditValue(readFirstValue(snapshot, ["fullName", "name"])) ??
      "Cadastro de pessoa";
    const cpf = formatCpf(normalizeAuditValue(readFirstValue(snapshot, ["cpf"])));
    const personType = formatPersonType(
      normalizeAuditValue(readFirstValue(snapshot, ["personType"])),
    );

    return {
      primary: fullName,
      secondary:
        [cpf, personType, buildAuditChangeSummary(before, after), seedNote]
          .filter(Boolean)
          .join(" | ") || null,
    };
  }

  if (log.action.startsWith("ACCESS_USER.")) {
    const email =
      normalizeAuditValue(readFirstValue(snapshot, ["email"])) ??
      log.actorUser?.email ??
      "Conta administrativa";
    const role = formatUserRole(normalizeAuditValue(readFirstValue(snapshot, ["role"])));
    const status = formatStatus(normalizeAuditValue(readFirstValue(snapshot, ["status"])));

    return {
      primary: email,
      secondary:
        [role, status, buildAuditChangeSummary(before, after), seedNote]
          .filter(Boolean)
          .join(" | ") || null,
    };
  }

  if (log.action.startsWith("TIME_ENTRY.")) {
    const totalMinutesValue = readFirstValue(metadata, ["totalMinutes"]);
    const totalMinutes =
      typeof totalMinutesValue === "number"
        ? totalMinutesValue
        : typeof totalMinutesValue === "string" &&
            !Number.isNaN(Number(totalMinutesValue))
          ? Number(totalMinutesValue)
          : null;
    const validationMode = formatValidationMode(
      normalizeAuditValue(readFirstValue(metadata, ["validationMode"])),
    );
    const notes = normalizeAuditValue(
      readFirstValue(metadata, ["validationNotes", "notes"]),
    );
    const originLabel =
      log.action === "TIME_ENTRY.OPENED"
        ? "Fluxo publico de entrada"
        : log.action === "TIME_ENTRY.CLOSED"
          ? "Fluxo publico de saida"
          : log.action === "TIME_ENTRY.MANUAL_CLOSE"
            ? "Encerramento manual pelo painel"
            : log.action === "TIME_ENTRY.AUTO_CLOSED"
              ? "Rotina automatica do sistema"
              : "Ajuste manual do registro";

    return {
      primary: originLabel,
      secondary:
        [
          totalMinutes !== null ? `Tempo ${formatMinutes(totalMinutes)}` : null,
          validationMode ? `Validacao ${validationMode}` : null,
          notes ? truncateText(notes) : null,
          seedNote,
        ]
          .filter(Boolean)
          .join(" | ") || null,
    };
  }

  return {
    primary: formatAuditEntity(log.entity),
    secondary:
      [buildAuditChangeSummary(before, after), seedNote]
        .filter(Boolean)
        .join(" | ") || null,
  };
}

function getAuditSearchText(log: AuditLogEntry) {
  const context = getAuditContext(log);
  const actorSearch = [log.actorUser?.name, log.actorUser?.email, log.actorUser?.role]
    .filter(Boolean)
    .join(" ");

  return [
    formatAuditAction(log.action),
    formatAuditEntity(log.entity),
    context.primary,
    context.secondary,
    actorSearch,
    log.ipAddress,
  ]
    .filter(Boolean)
    .join(" ");
}

export function AuditScreen() {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const logs = useAuditStore((state) => state.logs);
  const feedback = useAuditStore((state) => state.feedback);
  const filteredLogs = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");

    if (!normalizedSearch) {
      return logs;
    }

    return logs.filter((log) =>
      getAuditSearchText(log)
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedSearch),
    );
  }, [logs, search]);
  const columns = useMemo<ColumnDef<AuditLogEntry>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Quando",
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
      {
        id: "action",
        accessorFn: (row) =>
          `${formatAuditAction(row.action)} ${formatAuditEntity(row.entity)}`,
        header: "Acao",
        cell: ({ row }) => (
          <div className="space-y-1 whitespace-normal">
            <p className="font-semibold">
              {formatAuditAction(row.original.action)}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatAuditEntity(row.original.entity)}
            </p>
          </div>
        ),
      },
      {
        id: "actor",
        accessorFn: (row) =>
          row.actorUser?.name ?? row.actorUser?.email ?? "Sistema",
        header: "Responsavel",
        cell: ({ row }) => (
          <div className="space-y-1 whitespace-normal">
            <p className="font-semibold">
              {row.original.actorUser?.name ?? "Sistema"}
            </p>
            <p className="text-sm text-muted-foreground">
              {row.original.actorUser
                ? [row.original.actorUser.email, formatUserRole(row.original.actorUser.role)]
                    .filter(Boolean)
                    .join(" | ")
                : "Rotina automatica"}
            </p>
          </div>
        ),
      },
      {
        id: "context",
        accessorFn: (row) => {
          const context = getAuditContext(row);
          return [context.primary, context.secondary, row.ipAddress]
            .filter(Boolean)
            .join(" ");
        },
        header: "Contexto",
        cell: ({ row }) => {
          const context = getAuditContext(row.original);
          const details = [context.secondary, formatAuditLocation(row.original)]
            .filter(Boolean)
            .join(" | ");

          return (
            <div className="space-y-1 whitespace-normal text-sm">
              <p className="font-medium">{context.primary}</p>
              <p className="text-muted-foreground">
                {details || "Sem detalhes adicionais"}
              </p>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auditoria</CardTitle>
        <CardDescription>
          Login administrativo, alteracoes de ponto, encerramentos e acoes
          sensiveis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {feedback ? (
          <p className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
            {feedback}
          </p>
        ) : null}
        <DataTable
          data={filteredLogs}
          columns={columns}
          getRowId={(item) => item.id}
          queryStateScope="auditLogs"
          toolbar={
            <div className="grid gap-3">
              <Input
                value={search}
                onChange={(event) => void setSearch(event.target.value)}
                placeholder="Buscar por acao, responsavel ou contexto"
              />
            </div>
          }
        />
        {!filteredLogs.length ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <ScrollText className="size-4" />
            Nenhum log encontrado com os filtros atuais.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
