"use client";

import {
  Building2,
  CheckCircle2,
  LogIn,
  LogOut,
  MonitorSmartphone,
  ShieldCheck,
  TimerReset,
  UserRound,
  Wifi,
} from "lucide-react";
import { AccessFlowBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPersonTypeLabel } from "@/lib/utils";
import type { RegisterReceipt } from "@/store/register-store";

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(
  totalMinutes?: number | null,
  openedAt?: string | null,
  closedAt?: string | null,
) {
  const minutes =
    totalMinutes ??
    (openedAt && closedAt
      ? Math.max(
          0,
          Math.round((new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 60000),
        )
      : null);

  if (minutes === null || minutes === undefined) {
    return "-";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}min`;
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-300/40 bg-card/90 p-3">
      <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-emerald-700/80">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function RegisterSuccessCard({
  receipt,
  onReset,
}: {
  receipt: RegisterReceipt;
  onReset: () => void;
}) {
  const isExit = receipt.mode === "EXIT";
  const HeadlineIcon = isExit ? LogOut : LogIn;

  return (
    <section className="overflow-hidden rounded-[28px] border border-emerald-300/40 bg-emerald-500/10 shadow-sm">
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_46%)] p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <HeadlineIcon className="size-5" />
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <AccessFlowBadge mode={isExit ? "EXIT" : "ENTRY"} />
                <Badge variant="success">
                  <CheckCircle2 className="mr-1 size-3.5" />
                  Confirmado
                </Badge>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground sm:text-xl">
                  {isExit ? "Acesso encerrado com sucesso" : "Acesso liberado com sucesso"}
                </h3>
                <p className="mt-1 text-sm leading-6 text-emerald-900/80 dark:text-emerald-100/85">
                  {isExit
                    ? "A permanencia foi finalizada e o tempo total ja foi consolidado."
                    : "A entrada foi registrada. Na saida, basta abrir este mesmo QR novamente."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem icon={UserRound} label="Pessoa" value={receipt.entry.person.fullName} />
            <DetailItem icon={Building2} label="Usina" value={receipt.entry.plant.name} />
            <DetailItem
              icon={TimerReset}
              label={isExit ? "Tempo total" : "Status"}
              value={
                isExit
                  ? formatDuration(
                      receipt.entry.totalMinutes,
                      receipt.entry.openedAt,
                      receipt.entry.closedAt,
                    )
                  : "Em andamento"
              }
            />
            <DetailItem
              icon={ShieldCheck}
              label={isExit ? "Saida em" : "Entrada em"}
              value={formatDateTime(isExit ? receipt.entry.closedAt : receipt.entry.openedAt)}
            />
          </div>

          <div className="rounded-[24px] border border-emerald-300/40 bg-card/90 p-4">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Entrada registrada
                </p>
                <p className="mt-1 font-medium text-foreground">
                  {formatDateTime(receipt.entry.openedAt)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Rede validada
                </p>
                <p className="mt-1 inline-flex items-center gap-2 font-medium text-foreground">
                  <Wifi className="size-4 text-emerald-700" />
                  {receipt.entry.wifiSsid ?? receipt.entry.deviceIp ?? "Ambiente autorizado"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Perfil
                </p>
                <p className="mt-1 font-medium text-foreground">
                  {formatPersonTypeLabel(receipt.entry.person.personType)} / {receipt.entry.person.employer}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Dispositivo
                </p>
                <p className="mt-1 inline-flex items-center gap-2 font-medium text-foreground">
                  <MonitorSmartphone className="size-4 text-emerald-700" />
                  {receipt.entry.deviceLabel ?? "Dispositivo identificado"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-emerald-900/80 dark:text-emerald-100/85">
              {isExit
                ? "Registro finalizado. Voce ja pode iniciar uma nova consulta."
                : "Guarde este status. Na saida, reabra este QR para encerrar o acesso."}
            </p>
            <Button type="button" variant="secondary" onClick={onReset}>
              Novo registro
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
