"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  ShieldEllipsis,
  TimerReset,
  UserCog,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  formatActiveStatusLabel,
  formatTimeEntryStatusLabel,
  formatUserRoleLabel,
} from "@/lib/utils";

export function RealtimeBadge({ label = "Tempo real ativo" }: { label?: string }) {
  return (
    <Badge variant="info">
      <Activity className="size-3.5" />
      {label}
    </Badge>
  );
}

export function UserRoleBadge({ role }: { role?: string | null }) {
  const normalizedRole = role ?? "OPERACAO";

  if (normalizedRole === "SUPER_ADMIN") {
    return (
      <Badge variant="info">
        <ShieldCheck className="size-3.5" />
        {formatUserRoleLabel(normalizedRole)}
      </Badge>
    );
  }

  if (normalizedRole === "ADMIN") {
    return (
      <Badge variant="secondary">
        <UserCog className="size-3.5" />
        {formatUserRoleLabel(normalizedRole)}
      </Badge>
    );
  }

  if (normalizedRole === "PLANT_SUPERVISOR") {
    return (
      <Badge variant="warning">
        <ShieldEllipsis className="size-3.5" />
        {formatUserRoleLabel(normalizedRole)}
      </Badge>
    );
  }

  return <Badge variant="neutral">{formatUserRoleLabel(normalizedRole)}</Badge>;
}

export function ActiveStateBadge({ status }: { status?: string | null }) {
  const normalizedStatus = status ?? "UNKNOWN";

  if (normalizedStatus === "ACTIVE") {
    return (
      <Badge variant="success">
        <CheckCircle2 className="size-3.5" />
        {formatActiveStatusLabel(normalizedStatus)}
      </Badge>
    );
  }

  if (normalizedStatus === "INACTIVE") {
    return (
      <Badge variant="neutral">
        <TimerReset className="size-3.5" />
        {formatActiveStatusLabel(normalizedStatus)}
      </Badge>
    );
  }

  if (normalizedStatus === "LEAVE") {
    return (
      <Badge variant="warning">
        <TimerReset className="size-3.5" />
        {formatActiveStatusLabel(normalizedStatus)}
      </Badge>
    );
  }

  if (normalizedStatus === "BLOCKED") {
    return (
      <Badge variant="destructive">
        <AlertTriangle className="size-3.5" />
        {formatActiveStatusLabel(normalizedStatus)}
      </Badge>
    );
  }

  return <Badge variant="outline">{formatActiveStatusLabel(normalizedStatus)}</Badge>;
}

export function TimeEntryStatusBadge({ status }: { status?: string | null }) {
  const normalizedStatus = status ?? "UNKNOWN";

  if (normalizedStatus === "OPEN") {
    return (
      <Badge variant="warning">
        <TimerReset className="size-3.5" />
        {formatTimeEntryStatusLabel(normalizedStatus)}
      </Badge>
    );
  }

  if (normalizedStatus === "CLOSED") {
    return (
      <Badge variant="success">
        <CheckCircle2 className="size-3.5" />
        {formatTimeEntryStatusLabel(normalizedStatus)}
      </Badge>
    );
  }

  if (normalizedStatus === "ADJUSTED") {
    return (
      <Badge variant="info">
        <ShieldCheck className="size-3.5" />
        {formatTimeEntryStatusLabel(normalizedStatus)}
      </Badge>
    );
  }

  if (normalizedStatus === "AUTO_CLOSED") {
    return (
      <Badge variant="neutral">
        <TimerReset className="size-3.5" />
        {formatTimeEntryStatusLabel(normalizedStatus)}
      </Badge>
    );
  }

  return <Badge variant="outline">{formatTimeEntryStatusLabel(normalizedStatus)}</Badge>;
}

export function AccessFlowBadge({ mode }: { mode?: "ENTRY" | "EXIT" | "BLOCKED" | null }) {
  if (mode === "ENTRY") {
    return <Badge variant="success">Entrada</Badge>;
  }

  if (mode === "EXIT") {
    return <Badge variant="warning">Saida</Badge>;
  }

  if (mode === "BLOCKED") {
    return <Badge variant="destructive">Bloqueado</Badge>;
  }

  return <Badge variant="neutral">Pendente</Badge>;
}
